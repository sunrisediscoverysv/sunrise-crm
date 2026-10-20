// Estado de Chatwoot compartido entre `chatwoot-webhook` (escribe) y
// `chatwoot-status` (lee y decide el handoff de Botpress).
//
// Chatwoot es la fuente de verdad para conversation_id, assignee y status.
// `chatwoot_conversations` es solo una copia local para que Botpress pueda
// consultar en milisegundos sin depender de la API de Chatwoot en cada mensaje.

export type Channel = 'whatsapp' | 'instagram' | 'messenger' | 'other'

// Inboxes de Chatwoot de Sunrise → canal del CRM (respaldo cuando el payload
// no trae la cadena de canal explícita).
export const INBOX_CHANNEL: Record<number, Channel> = {
  113656: 'whatsapp',
  116531: 'instagram',
  116606: 'messenger',
}

export function channelFromString(s: string): Channel | '' {
  const l = s.toLowerCase()
  if (l.includes('whatsapp')) return 'whatsapp'
  if (l.includes('instagram')) return 'instagram'
  if (l.includes('facebook') || l.includes('messenger')) return 'messenger'
  return ''
}

/** Solo dígitos: identidad canónica de WhatsApp en todo el CRM. */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/** Estados de Chatwoot en los que la conversación sigue viva. */
const ACTIVE_STATUSES = new Set(['open', 'pending', 'snoozed'])

export interface ConversationState {
  chatwoot_conversation_id: number
  chatwoot_contact_id: number | null
  chatwoot_inbox_id: number | null
  channel: Channel
  source_id: string | null
  contact_identifier: string | null
  phone_digits: string | null
  status: string | null
  assignee_id: number | null
  assignee_name: string | null
  is_assigned: boolean
  last_event_at?: string
}

// ---------------------------------------------------------------------------
// Decisión de handoff — lógica pura, sin red ni base de datos (testeable).
// ---------------------------------------------------------------------------

export function isResolved(status: string | null | undefined): boolean {
  return (status ?? '').toLowerCase() === 'resolved'
}

export function isActive(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has((status ?? '').toLowerCase())
}

/**
 * Botpress debe callarse solo si hay un humano al mando de una conversación viva.
 *   agente asignado  +  status != resolved  → true
 *   status = resolved                        → false
 *   sin agente                               → false
 */
export function computeHandoff(
  state: Pick<ConversationState, 'is_assigned' | 'assignee_id' | 'status'>,
): boolean {
  const assigned = state.is_assigned && state.assignee_id != null
  return assigned && !isResolved(state.status)
}

/**
 * Elige la conversación relevante cuando el contacto tiene varias.
 * Prioridad: (1) activa (open/pending/snoozed) más reciente,
 *            (2) si no hay ninguna activa, la más reciente de todas.
 * Las resueltas antiguas quedan ignoradas si existe una activa posterior.
 */
export function pickRelevantConversation<
  T extends { status: string | null; last_event_at?: string | null },
>(rows: T[]): T | null {
  if (rows.length === 0) return null
  const byRecency = [...rows].sort(
    (a, b) => Date.parse(b.last_event_at ?? '') - Date.parse(a.last_event_at ?? ''),
  )
  return byRecency.find(r => isActive(r.status)) ?? byRecency[0]
}

// ---------------------------------------------------------------------------
// Cliente de la API de Chatwoot. Reutiliza las mismas variables de entorno que
// `chatwoot-send`; nunca se hardcodea ningún token.
// ---------------------------------------------------------------------------

const env = (k: string) => Deno.env.get(k) ?? ''

export function chatwootConfigured(): boolean {
  return !!env('CHATWOOT_BASE_URL') && !!env('CHATWOOT_ACCOUNT_ID') && !!env('CHATWOOT_API_TOKEN')
}

async function chatwootGet(path: string): Promise<Record<string, unknown> | null> {
  if (!chatwootConfigured()) return null
  const base = env('CHATWOOT_BASE_URL').replace(/\/$/, '')
  const account = env('CHATWOOT_ACCOUNT_ID')
  try {
    const res = await fetch(`${base}/api/v1/accounts/${account}${path}`, {
      headers: { api_access_token: env('CHATWOOT_API_TOKEN') },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      console.error(`[chatwoot-api] ${path} → ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.error(`[chatwoot-api] ${path} falló:`, err)
    return null
  }
}

/** Conversación completa: la verdad sobre assignee y status. */
export function getConversation(id: number | string) {
  return chatwootGet(`/conversations/${id}`)
}

/**
 * `source_id` = identificador del usuario en la plataforma externa (PSID de
 * Messenger, IGSID de Instagram). Es el que ve Botpress como `instagram:id`.
 * NO viene en el webhook: hay que pedir el contacto a la API.
 */
export async function getContactSourceId(
  contactId: number,
  inboxId: number | null,
): Promise<string | null> {
  const contact = await chatwootGet(`/contacts/${contactId}`)
  const payload = (contact?.payload ?? contact) as Record<string, unknown> | undefined
  const inboxes = (payload?.contact_inboxes ?? []) as Array<Record<string, unknown>>
  if (!Array.isArray(inboxes) || inboxes.length === 0) return null
  const match = inboxId != null
    ? inboxes.find(ci => Number((ci.inbox as Record<string, unknown> | undefined)?.id) === inboxId)
    : undefined
  const chosen = match ?? inboxes[0]
  const sourceId = chosen?.source_id
  return sourceId == null ? null : String(sourceId)
}

// ---------------------------------------------------------------------------
// Extracción del estado desde un payload de webhook de Chatwoot.
// ---------------------------------------------------------------------------

interface SenderLike {
  id?: number
  phone_number?: string | null
  identifier?: string | null
}
interface AssigneeLike {
  id?: number
  name?: string | null
  available_name?: string | null
}
interface MetaLike {
  sender?: SenderLike | null
  assignee?: AssigneeLike | null
}
interface WebhookLike {
  event?: string
  channel?: string
  inbox?: { id?: number } | null
  conversation?: {
    id?: number
    status?: string
    channel?: string
    inbox_id?: number
    meta?: MetaLike | null
  } | null
  // Los eventos conversation_* traen la conversación en la raíz, no anidada.
  id?: number
  status?: string
  inbox_id?: number
  meta?: MetaLike | null
}

/**
 * Normaliza cualquier evento de Chatwoot a un ConversationState.
 * Devuelve null si el payload no identifica una conversación.
 *
 * Sobre `assignee`: los eventos `conversation_*` lo traen en `meta.assignee`;
 * `message_created` a veces no. Cuando la clave falta se devuelve
 * `assigneeKnown = false` para que quien llame consulte la API en vez de asumir
 * "sin agente" — asumirlo desasignaría por error y Botpress volvería a hablar
 * encima del humano.
 */
export function stateFromWebhook(
  payload: WebhookLike,
): { state: ConversationState; assigneeKnown: boolean } | null {
  const conv = payload.conversation ?? payload
  const convId = Number(conv?.id ?? 0)
  if (!convId) return null

  const meta = conv?.meta ?? null
  const sender = meta?.sender ?? null
  const inboxId = conv?.inbox_id ?? payload.inbox?.id ?? null

  const digits = phoneDigits(sender?.phone_number)
  const channel: Channel =
    channelFromString(String(conv?.channel ?? payload.channel ?? '')) ||
    (inboxId != null ? INBOX_CHANNEL[inboxId] : '') ||
    (digits ? 'whatsapp' : 'other')

  // `assignee` ausente ≠ desasignada. Solo la clave presente y nula cuenta
  // como desasignación explícita.
  const hasAssigneeKey = meta != null && 'assignee' in meta
  const assignee = meta?.assignee ?? null
  const assigneeId = assignee?.id != null ? Number(assignee.id) : null

  return {
    assigneeKnown: hasAssigneeKey,
    state: {
      chatwoot_conversation_id: convId,
      chatwoot_contact_id: sender?.id != null ? Number(sender.id) : null,
      chatwoot_inbox_id: inboxId != null ? Number(inboxId) : null,
      channel,
      source_id: null, // solo lo da la API
      contact_identifier: sender?.identifier != null ? String(sender.identifier) : null,
      phone_digits: digits || null,
      status: conv?.status != null ? String(conv.status) : null,
      assignee_id: assigneeId,
      assignee_name: assignee?.available_name ?? assignee?.name ?? null,
      is_assigned: assigneeId != null,
    },
  }
}

// ---------------------------------------------------------------------------
// Persistencia idempotente.
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type SupabaseLike = any

/**
 * Upsert por `chatwoot_conversation_id` (clave primaria): los webhooks se
 * reintentan y no debe haber filas duplicadas.
 *
 * Los campos nulos no pisan lo ya guardado: un `message_created` sin assignee
 * no puede borrar el agente que registró un `conversation_updated` anterior.
 */
export async function upsertConversationState(
  admin: SupabaseLike,
  state: ConversationState,
  opts: { clientId?: string | null; assigneeKnown?: boolean } = {},
): Promise<void> {
  const row: Record<string, unknown> = {
    chatwoot_conversation_id: state.chatwoot_conversation_id,
    channel: state.channel,
    last_event_at: new Date().toISOString(),
  }

  // Solo escribimos lo que este evento realmente sabe.
  if (state.chatwoot_contact_id != null) row.chatwoot_contact_id = state.chatwoot_contact_id
  if (state.chatwoot_inbox_id != null) row.chatwoot_inbox_id = state.chatwoot_inbox_id
  if (state.source_id != null) row.source_id = state.source_id
  if (state.contact_identifier != null) row.contact_identifier = state.contact_identifier
  if (state.phone_digits != null) row.phone_digits = state.phone_digits
  if (state.status != null) row.status = state.status
  if (opts.clientId != null) row.client_id = opts.clientId

  // El agente solo se toca si el evento lo reporta de forma fiable.
  if (opts.assigneeKnown) {
    row.assignee_id = state.assignee_id
    row.assignee_name = state.assignee_name
    row.is_assigned = state.is_assigned
  }

  const { error } = await admin
    .from('chatwoot_conversations')
    .upsert(row, { onConflict: 'chatwoot_conversation_id' })
  if (error) console.error('[chatwoot-sync] upsert falló:', error)
}

/**
 * Una página de mensajes de la conversación (Chatwoot devuelve ~20, del más
 * viejo al más nuevo). Con `before` trae los anteriores a ese id.
 */
export async function getConversationMessages(
  convId: number | string,
  before?: number,
): Promise<Array<{ id?: number; attachments?: unknown }>> {
  const data = await chatwootGet(`/conversations/${convId}/messages${before ? `?before=${before}` : ''}`)
  const payload = (data as { payload?: unknown } | null)?.payload
  return Array.isArray(payload) ? payload : []
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'document'

/** Adjunto de Chatwoot tal como lo guarda el CRM en raw_payload.attachments. */
export interface ChatwootAttachment {
  kind: AttachmentKind
  url: string
  thumb_url: string | null
  file_name: string
  size: number
}

const ATTACHMENT_KIND: Record<string, AttachmentKind> = {
  image: 'image', video: 'video', audio: 'audio', file: 'document',
}

/**
 * Normaliza `attachments` de un mensaje de Chatwoot (webhook o API). `data_url`
 * es un enlace de Chatwoot que no vence y se abre sin sesión. Los tipos sin
 * archivo (ubicación, contacto…) se descartan.
 */
export function normalizeChatwootAttachments(raw: unknown): ChatwootAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: ChatwootAttachment[] = []
  for (const a of raw as Array<Record<string, unknown>>) {
    const url = typeof a?.data_url === 'string' ? a.data_url : ''
    if (!url) continue
    const fileType = String(a.file_type ?? '').toLowerCase()
    let fileName = 'archivo'
    try {
      fileName = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'archivo')
    } catch {
      // data_url sin forma de URL: se queda el nombre genérico
    }
    out.push({
      kind: ATTACHMENT_KIND[fileType] ?? 'document',
      url,
      thumb_url: typeof a.thumb_url === 'string' && a.thumb_url ? a.thumb_url : null,
      file_name: fileName,
      size: Number(a.file_size ?? 0) || 0,
    })
  }
  return out
}
