// Envía un mensaje saliente a una conversación de Chatwoot (Instagram, Messenger,
// etc.). El CRM llama a esta función; Chatwoot lo entrega por el canal conectado.
//   POST { client_id, text }  (con JWT de un agente autenticado)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const env = (k: string) => Deno.env.get(k) ?? ''

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  // Autenticación: el que llama debe ser un usuario autenticado del CRM.
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return json({ error: 'No autorizado' }, 401)
  const { data: userData } = await admin.auth.getUser(token)
  if (!userData.user) return json({ error: 'No autorizado' }, 401)

  const body = await req.json().catch(() => ({}))
  const clientId = String(body.client_id ?? '')
  const text = String(body.text ?? '').trim()
  if (!clientId || !text) return json({ error: 'client_id y text son requeridos' }, 400)

  const base = env('CHATWOOT_BASE_URL').replace(/\/$/, '')
  const account = env('CHATWOOT_ACCOUNT_ID')
  const apiToken = env('CHATWOOT_API_TOKEN')
  if (!base || !account || !apiToken) return json({ error: 'Chatwoot no está configurado' }, 500)

  // Conversación de Chatwoot del cliente: la del último mensaje reflejado.
  const { data: lastMsg } = await admin
    .from('messages')
    .select('raw_payload')
    .eq('client_id', clientId)
    .not('raw_payload->>chatwoot_conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const convId = (lastMsg as { raw_payload?: { chatwoot_conversation_id?: number | string } } | null)
    ?.raw_payload?.chatwoot_conversation_id
  if (!convId) return json({ error: 'no_conversation' }, 409)

  // Canal del cliente (para etiquetar el mensaje guardado).
  const { data: clientRow } = await admin.from('clients').select('channel').eq('id', clientId).single()
  const channel = (clientRow as { channel?: string } | null)?.channel ?? 'other'

  // Enviar a Chatwoot.
  const res = await fetch(`${base}/api/v1/accounts/${account}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', api_access_token: apiToken },
    body: JSON.stringify({ content: text, message_type: 'outgoing' }),
  })
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: 'chatwoot_error', detail: detail.slice(0, 500) }, 502)
  }
  const sent = await res.json()

  // Reflejar el saliente en el CRM. El chatwoot_message_id evita que el webhook
  // de eco (Chatwoot reenvía este mismo mensaje) lo duplique.
  await admin.from('messages').insert({
    client_id: clientId,
    channel,
    direction: 'outbound',
    content: text,
    raw_payload: {
      source: 'chatwoot',
      chatwoot_message_id: sent?.id ?? null,
      chatwoot_conversation_id: convId,
      agent_name: userData.user.user_metadata?.full_name ?? null,
    },
  })
  await admin.from('clients').update({ last_contact_at: new Date().toISOString() }).eq('id', clientId)

  return json({ ok: true, chatwoot_message_id: sent?.id ?? null })
})
