// ¿Esta persona ya la está atendiendo un humano en Chatwoot?
//
//   POST /functions/v1/chatwoot-status
//   x-webhook-secret: <BOTPRESS_WEBHOOK_SECRET>
//   { "channel": "instagram", "external_user_id": "2227588257804403" }
//
// Responde `handoff: true` solo si hay agente asignado y la conversación no
// está resuelta. Cualquier fallo responde `handoff: false`: es preferible que
// el bot hable de más a que se quede mudo por un error de infraestructura.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeHandoff,
  getConversation,
  isResolved,
  phoneDigits,
  pickRelevantConversation,
  stateFromWebhook,
  upsertConversationState,
} from '../_shared/chatwoot.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-botpress-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const env = (k: string) => Deno.env.get(k) ?? ''

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

/** Respuesta neutra: el bot sigue hablando. */
function notFound(channel: string, externalUserId: string, extra: Record<string, unknown> = {}) {
  return json({
    success: true,
    found: false,
    channel,
    external_user_id: externalUserId,
    conversation_id: null,
    assigned: false,
    assignee_id: null,
    status: null,
    resolved: false,
    handoff: false,
    ...extra,
  })
}

// Si el espejo local lleva más de esto sin actualizarse, se contrasta con la
// API de Chatwoot antes de responder (Chatwoot es la fuente de verdad).
const STALE_MS = 5 * 60 * 1000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // Mismo secreto y misma convención de cabecera que botpress-webhook; se
  // acepta también x-botpress-secret por comodidad del lado de Botpress.
  const secret = env('BOTPRESS_WEBHOOK_SECRET')
  const incoming = req.headers.get('x-webhook-secret') ?? req.headers.get('x-botpress-secret') ?? ''
  if (!secret || !timingSafeEqual(incoming, secret)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({})) as {
    channel?: string
    external_user_id?: string | number
  }
  const channel = String(body.channel ?? '').toLowerCase()
  const rawId = String(body.external_user_id ?? '').trim()

  if (!channel || !rawId) {
    return json({ error: 'channel y external_user_id son requeridos' }, 400)
  }
  if (!['whatsapp', 'instagram', 'messenger'].includes(channel)) {
    return json({ error: `channel no soportado: ${channel}` }, 400)
  }

  // WhatsApp se normaliza a solo dígitos: Botpress puede mandar '+503 7777 0000'
  // y el CRM guarda '50377770000'.
  const lookupId = channel === 'whatsapp' ? phoneDigits(rawId) : rawId
  if (!lookupId) return notFound(channel, rawId)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  try {
    // El id externo puede estar guardado en cualquiera de las identidades según
    // el canal y según si la API ya nos dio el source_id. Se buscan todas.
    const numericId = /^\d+$/.test(lookupId) ? lookupId : null
    const filters = [
      `source_id.eq.${lookupId}`,
      `contact_identifier.eq.${lookupId}`,
      ...(numericId ? [`chatwoot_contact_id.eq.${numericId}`] : []),
      ...(channel === 'whatsapp' ? [`phone_digits.eq.${lookupId}`] : []),
    ]

    const { data, error } = await admin
      .from('chatwoot_conversations')
      .select(
        'chatwoot_conversation_id, status, assignee_id, assignee_name, is_assigned, last_event_at',
      )
      .eq('channel', channel)
      .or(filters.join(','))
      .order('last_event_at', { ascending: false })
      .limit(25)

    if (error) {
      console.error('[chatwoot-status] consulta falló:', error)
      return notFound(channel, rawId, { success: false, error: 'lookup_failed' })
    }

    const rows = (data ?? []) as Array<{
      chatwoot_conversation_id: number
      status: string | null
      assignee_id: number | null
      assignee_name: string | null
      is_assigned: boolean
      last_event_at: string
    }>

    let chosen = pickRelevantConversation(rows)
    if (!chosen) return notFound(channel, rawId)

    // Fuente de verdad: si la copia local está vieja, se contrasta con Chatwoot.
    // Si la API falla, seguimos con lo que tenemos en vez de romper la respuesta.
    const age = Date.now() - Date.parse(chosen.last_event_at)
    if (Number.isFinite(age) && age > STALE_MS) {
      const fresh = await getConversation(chosen.chatwoot_conversation_id)
      const parsed = fresh ? stateFromWebhook(fresh) : null
      if (parsed) {
        chosen = {
          ...chosen,
          status: parsed.state.status ?? chosen.status,
          assignee_id: parsed.assigneeKnown ? parsed.state.assignee_id : chosen.assignee_id,
          assignee_name: parsed.assigneeKnown ? parsed.state.assignee_name : chosen.assignee_name,
          is_assigned: parsed.assigneeKnown ? parsed.state.is_assigned : chosen.is_assigned,
        }
        // Refrescar el espejo para que la próxima consulta no repita la llamada.
        await upsertConversationState(
          admin,
          { ...parsed.state, chatwoot_conversation_id: chosen.chatwoot_conversation_id },
          { assigneeKnown: parsed.assigneeKnown },
        )
      }
    }

    const handoff = computeHandoff(chosen)
    // Traza de cada decisión: imprescindible para auditar carreras de timing
    // entre la asignación en Chatwoot y la consulta de Botpress.
    console.log('[chatwoot-status]', JSON.stringify({
      channel, external_user_id: rawId,
      conv: chosen.chatwoot_conversation_id, status: chosen.status,
      assignee_id: chosen.assignee_id, is_assigned: chosen.is_assigned, handoff,
    }))
    return json({
      success: true,
      found: true,
      channel,
      external_user_id: rawId,
      conversation_id: chosen.chatwoot_conversation_id,
      assigned: chosen.is_assigned && chosen.assignee_id != null,
      assignee_id: chosen.assignee_id,
      assignee_name: chosen.assignee_name,
      status: chosen.status,
      resolved: isResolved(chosen.status),
      handoff,
    })
  } catch (err) {
    // Nunca silenciar a Botpress por un error nuestro.
    console.error('[chatwoot-status] error inesperado:', err)
    return notFound(channel, rawId, { success: false, error: 'internal_error' })
  }
})
