import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Recibe webhooks de Chatwoot (evento message_created) y refleja en el CRM
// los mensajes salientes escritos por agentes humanos desde Chatwoot, para
// que la conversación se vea completa en /inbox mientras dure la transición.
//
// Autenticación (basta con que pase una de las dos):
// 1. Firma HMAC de Chatwoot: X-Chatwoot-Signature = sha256=HMAC(secret,
//    "{timestamp}.{raw_body}") con el secret que Chatwoot muestra al crear el
//    webhook (env CHATWOOT_WEBHOOK_SECRET).
// 2. Token en la query string: ?token=<CHATWOOT_WEBHOOK_TOKEN>. Se mantiene
//    como respaldo porque hay versiones de Chatwoot con la firma rota
//    (github.com/chatwoot/chatwoot/issues/13809) o que no firman.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Verifica la firma HMAC-SHA256 de Chatwoot sobre "{timestamp}.{raw_body}".
// Rechaza timestamps a más de 10 minutos para evitar replay de peticiones.
async function verifyChatwootSignature(secret: string, rawBody: string, req: Request): Promise<boolean> {
  const signature = req.headers.get('x-chatwoot-signature') ?? ''
  const timestamp = req.headers.get('x-chatwoot-timestamp') ?? ''
  if (!signature.startsWith('sha256=') || !timestamp) return false
  const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(skewSeconds) || skewSeconds > 600) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const expected = 'sha256=' + [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(signature, expected)
}

interface ChatwootPayload {
  event?: string
  id?: number
  content?: string | null
  message_type?: string
  private?: boolean
  attachments?: unknown[]
  sender?: { id?: number; name?: string; type?: string } | null
  conversation?: {
    id?: number
    meta?: { sender?: { phone_number?: string | null; identifier?: string | null } | null } | null
  } | null
}

const CONTENT_MAX_LENGTH = 4000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rawBody = await req.text()

  const expectedToken = Deno.env.get('CHATWOOT_WEBHOOK_TOKEN')
  const incomingToken = new URL(req.url).searchParams.get('token') ?? ''
  const tokenOk = !!expectedToken && timingSafeEqual(incomingToken, expectedToken)

  const signingSecret = Deno.env.get('CHATWOOT_WEBHOOK_SECRET')
  const signatureOk = !tokenOk && !!signingSecret &&
    await verifyChatwootSignature(signingSecret, rawBody, req)

  if (!tokenOk && !signatureOk) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: ChatwootPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  // Solo nos interesan los mensajes salientes escritos por agentes humanos
  // (sender.type === 'user'). Los entrantes ya los registra botpress-webhook,
  // las notas privadas no son parte de la conversación con el cliente, y los
  // mensajes del bot (agent_bot) se ignoran para no mezclar orígenes.
  if (payload.event !== 'message_created') return json({ status: 'ignored', reason: 'event' })
  if (payload.message_type !== 'outgoing') return json({ status: 'ignored', reason: 'message_type' })
  if (payload.private === true) return json({ status: 'ignored', reason: 'private' })
  if (payload.sender?.type !== 'user') return json({ status: 'ignored', reason: 'sender_type' })

  const phoneRaw = payload.conversation?.meta?.sender?.phone_number ?? ''
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  if (!phoneDigits) return json({ status: 'ignored', reason: 'no_phone' })

  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0
  const content = (payload.content?.trim() || (hasAttachments ? '[Adjunto]' : ''))
    .slice(0, CONTENT_MAX_LENGTH)
  if (!content) return json({ status: 'ignored', reason: 'empty_content' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  // Buscar el cliente: para WhatsApp, channel_user_id son los dígitos del
  // teléfono (contrato de botpress-webhook); como respaldo, el teléfono tal
  // cual llega de Chatwoot (formato +503...).
  let clientId: string | null = null
  const { data: byChannelId } = await supabase
    .from('clients')
    .select('id')
    .eq('channel', 'whatsapp')
    .eq('channel_user_id', phoneDigits)
    .maybeSingle()
  clientId = (byChannelId as { id: string } | null)?.id ?? null

  if (!clientId && phoneRaw) {
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', phoneRaw)
      .limit(1)
      .maybeSingle()
    clientId = (byPhone as { id: string } | null)?.id ?? null
  }

  // Un saliente hacia un contacto que el CRM no conoce no crea cliente: el
  // cliente siempre nace del primer mensaje entrante vía botpress-webhook.
  if (!clientId) {
    console.log(`[chatwoot-webhook] cliente no encontrado para ${phoneRaw}`)
    return json({ status: 'ignored', reason: 'client_not_found' })
  }

  // Idempotencia: Chatwoot reintenta webhooks fallidos; no duplicar el mensaje.
  if (payload.id != null) {
    const { data: dupe } = await supabase
      .from('messages')
      .select('id')
      .eq('client_id', clientId)
      .eq('raw_payload->>chatwoot_message_id', String(payload.id))
      .limit(1)
      .maybeSingle()
    if (dupe) return json({ status: 'ignored', reason: 'duplicate' })
  }

  const { error: insertError } = await supabase.from('messages').insert({
    client_id: clientId,
    channel: 'whatsapp',
    direction: 'outbound',
    content,
    raw_payload: {
      source: 'chatwoot',
      chatwoot_message_id: payload.id ?? null,
      chatwoot_conversation_id: payload.conversation?.id ?? null,
      agent_name: payload.sender?.name ?? null,
    },
  })
  if (insertError) {
    console.error('[chatwoot-webhook] error insertando mensaje:', insertError)
    return json({ error: 'Failed to insert message' }, 500)
  }

  await supabase.from('clients').update({ last_contact_at: new Date().toISOString() }).eq('id', clientId)

  return json({ status: 'ok', client_id: clientId })
})
