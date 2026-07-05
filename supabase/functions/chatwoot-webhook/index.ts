import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Recibe webhooks de Chatwoot (evento message_created) y refleja en el CRM
// la conversación completa mientras dure la transición:
// - Salientes escritos por agentes humanos → outbound.
// - Entrantes del cliente cuando la conversación YA NO está en fase bot
//   (status !== 'pending') → inbound. Chatwoot solo reenvía mensajes a
//   Botpress durante la fase bot, así que cuando un agente toma la
//   conversación las respuestas del cliente dejan de pasar por Botpress
//   (y por botpress-webhook); sin esto, nunca llegarían al CRM.
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
  message_type?: string | number
  private?: boolean
  attachments?: unknown[]
  sender?: { id?: number; name?: string; type?: string } | null
  conversation?: {
    id?: number
    status?: string
    meta?: { sender?: { phone_number?: string | null; identifier?: string | null; name?: string | null } | null } | null
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

  // Traza compacta de cada webhook para diagnosticar filtros contra el
  // payload real (visible en los logs de la función en el dashboard).
  const trace = {
    event: payload.event ?? null,
    message_type: payload.message_type ?? null,
    sender_type: payload.sender?.type ?? null,
    status: payload.conversation?.status ?? null,
    private: payload.private ?? null,
    chatwoot_message_id: payload.id ?? null,
  }
  function ignored(reason: string): Response {
    console.log(`[chatwoot-webhook] ignored=${reason}`, JSON.stringify(trace))
    return json({ status: 'ignored', reason })
  }

  // Se reflejan dos casos; el resto se ignora (notas privadas, mensajes del
  // bot/agent_bot, eventos que no son message_created):
  // - outgoing de agente humano (sender.type 'user') → outbound.
  // - incoming del contacto → inbound, SIN mirar conversation.status: en este
  //   Chatwoot las conversaciones viven en 'pending' aunque un agente ya esté
  //   respondiendo, así que el status no distingue la fase bot. El posible
  //   doble registro con botpress-webhook se resuelve con dedup cruzado por
  //   contenido reciente (aquí y en botpress-webhook).
  //   El sender de un incoming solo puede ser el contacto, así que basta con
  //   que sender.type no diga otra cosa (en estos payloads viene ausente).
  // message_type llega como string en los webhooks, pero se tolera la forma
  // numérica de la API (0 = incoming, 1 = outgoing) por si acaso.
  if (payload.event !== 'message_created') return ignored('event')
  if (payload.private === true) return ignored('private')

  const messageType = payload.message_type === 0 ? 'incoming'
    : payload.message_type === 1 ? 'outgoing'
    : payload.message_type
  const senderType = payload.sender?.type?.toLowerCase() ?? null

  let direction: 'inbound' | 'outbound'
  if (messageType === 'outgoing' && senderType === 'user') {
    direction = 'outbound'
  } else if (messageType === 'incoming' && (senderType === null || senderType === 'contact')) {
    direction = 'inbound'
  } else {
    return ignored('message_type_sender')
  }

  const phoneRaw = payload.conversation?.meta?.sender?.phone_number ?? ''
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  if (!phoneDigits) return ignored('no_phone')

  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0
  const content = (payload.content?.trim() || (hasAttachments ? '[Adjunto]' : ''))
    .slice(0, CONTENT_MAX_LENGTH)
  if (!content) return ignored('empty_content')

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

  // Un entrante de un número que el CRM no conoce crea un contacto mínimo NO
  // registrado (registered = false): así toda conversación aparece en la
  // bandeja aunque el bot nunca haya capturado datos, y el inbox muestra el
  // label "No registrado" con el botón "Agregar como cliente". Un saliente
  // hacia un desconocido sí se sigue ignorando: no hay conversación que mostrar.
  if (!clientId && direction === 'inbound') {
    const contactName = payload.conversation?.meta?.sender?.name?.trim() || null
    const { data: created, error: createError } = await supabase
      .from('clients')
      .insert({
        channel: 'whatsapp',
        channel_user_id: phoneDigits,
        full_name: contactName ?? (phoneRaw || phoneDigits),
        phone: phoneRaw || phoneDigits,
        source: 'WhatsApp',
        registered: false,
        last_contact_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (created) {
      clientId = (created as { id: string }).id
      console.log(`[chatwoot-webhook] contacto no registrado creado para ${phoneRaw}: ${clientId}`)
    } else if ((createError as { code?: string } | null)?.code === '23505') {
      // Carrera con otro webhook concurrente: recuperar el que ganó.
      const { data: raced } = await supabase
        .from('clients')
        .select('id')
        .eq('channel', 'whatsapp')
        .eq('channel_user_id', phoneDigits)
        .maybeSingle()
      clientId = (raced as { id: string } | null)?.id ?? null
    } else {
      console.error('[chatwoot-webhook] error creando contacto no registrado:', createError)
    }
  }

  if (!clientId) {
    console.log(`[chatwoot-webhook] cliente no encontrado para ${phoneRaw}`)
    return ignored('client_not_found')
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
    if (dupe) return ignored('duplicate')
  }

  // Dedup cruzado: si botpress-webhook ya registró este mismo entrante hace
  // poco (mismo cliente y contenido, origen NO chatwoot), no lo repetimos.
  // Solo se compara contra filas de otras fuentes: dos mensajes idénticos y
  // seguidos del cliente vía Chatwoot son legítimos (traen distinto
  // chatwoot_message_id) y no deben tragarse.
  if (direction === 'inbound') {
    const { data: recentDupe } = await supabase
      .from('messages')
      .select('id')
      .eq('client_id', clientId)
      .eq('direction', 'inbound')
      .eq('content', content)
      .or('raw_payload->>source.is.null,raw_payload->>source.neq.chatwoot')
      .gte('created_at', new Date(Date.now() - 90_000).toISOString())
      .limit(1)
      .maybeSingle()
    if (recentDupe) return ignored('recent_duplicate')
  }

  const { error: insertError } = await supabase.from('messages').insert({
    client_id: clientId,
    channel: 'whatsapp',
    direction,
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

  console.log(`[chatwoot-webhook] inserted direction=${direction}`, JSON.stringify(trace))
  return json({ status: 'ok', client_id: clientId })
})
