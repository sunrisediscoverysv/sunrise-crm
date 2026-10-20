// Completa los adjuntos de mensajes viejos que el CRM guardó solo como
// "[Adjunto]" (antes el webhook no guardaba el enlace al archivo). El hilo del
// CRM la llama una vez al abrir un chat que tiene adjuntos sin enlace; los
// busca en la API de Chatwoot por chatwoot_message_id y los deja en
// raw_payload.attachments. Los que ya no existen en Chatwoot quedan con
// attachments = [] para no volver a buscarlos.
//   POST { client_id }  (con JWT de un usuario del CRM) → { updated, missing }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  chatwootConfigured,
  getConversationMessages,
  normalizeChatwootAttachments,
  type ChatwootAttachment,
} from '../_shared/chatwoot.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tope de páginas de ~20 mensajes por conversación (≈ 1 000 mensajes hacia atrás).
const MAX_PAGES_PER_CONVERSATION = 50

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

interface PendingRow {
  id: string
  raw_payload: Record<string, unknown> | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  })

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return json({ error: 'No autorizado' }, 401)
  const { data: userData } = await admin.auth.getUser(token)
  if (!userData.user) return json({ error: 'No autorizado' }, 401)

  const body = await req.json().catch(() => ({}))
  const clientId = String(body.client_id ?? '')
  if (!clientId) return json({ error: 'client_id es requerido' }, 400)
  if (!chatwootConfigured()) return json({ error: 'Chatwoot no está configurado' }, 500)

  const { data, error } = await admin
    .from('messages')
    .select('id, raw_payload')
    .eq('client_id', clientId)
    .eq('content', '[Adjunto]')
    .not('raw_payload->>chatwoot_message_id', 'is', null)
    .is('raw_payload->attachments', null)
    .limit(300)
  if (error) return json({ error: error.message }, 500)
  const rows = (data ?? []) as PendingRow[]
  if (rows.length === 0) return json({ updated: 0, missing: 0 })

  // chatwoot_message_id pendientes, agrupados por conversación
  const byConversation = new Map<string, Map<number, PendingRow>>()
  for (const row of rows) {
    const convId = String(row.raw_payload?.chatwoot_conversation_id ?? '')
    const msgId = Number(row.raw_payload?.chatwoot_message_id)
    if (!convId || !msgId) continue
    if (!byConversation.has(convId)) byConversation.set(convId, new Map())
    byConversation.get(convId)!.set(msgId, row)
  }

  const found = new Map<string, ChatwootAttachment[]>() // id de fila → adjuntos
  // Conversaciones que sí se pudieron leer: solo ahí un faltante es definitivo
  // (si la API falló, se reintenta la próxima vez que se abra el chat).
  const scanned = new Set<string>()
  for (const [convId, pending] of byConversation) {
    const oldestWanted = Math.min(...pending.keys())
    let before: number | undefined
    for (let page = 0; page < MAX_PAGES_PER_CONVERSATION && pending.size > 0; page++) {
      const messages = await getConversationMessages(convId, before)
      if (messages.length === 0) break
      scanned.add(convId)
      for (const m of messages) {
        const row = m.id != null ? pending.get(m.id) : undefined
        if (!row) continue
        found.set(row.id, normalizeChatwootAttachments(m.attachments))
        pending.delete(m.id!)
      }
      const oldestInPage = Math.min(...messages.map(m => Number(m.id ?? Infinity)))
      if (!Number.isFinite(oldestInPage) || oldestInPage <= oldestWanted) break
      before = oldestInPage
    }
  }

  let updated = 0
  let missing = 0
  for (const row of rows) {
    const attachments = found.get(row.id)
    if (!attachments && !scanned.has(String(row.raw_payload?.chatwoot_conversation_id ?? ''))) continue
    if (attachments && attachments.length > 0) updated++
    else missing++
    await admin
      .from('messages')
      .update({ raw_payload: { ...(row.raw_payload ?? {}), attachments: attachments ?? [] } })
      .eq('id', row.id)
  }

  return json({ updated, missing })
})
