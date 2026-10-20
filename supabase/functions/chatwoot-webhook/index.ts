import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getContactSourceId,
  getConversation,
  stateFromWebhook,
  upsertConversationState,
} from '../_shared/chatwoot.ts'

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
  channel?: string
  inbox?: { id?: number } | null
  sender?: { id?: number; name?: string; type?: string } | null
  conversation?: {
    id?: number
    status?: string
    channel?: string
    inbox_id?: number
    meta?: { sender?: { id?: number; phone_number?: string | null; identifier?: string | null; name?: string | null } | null } | null
  } | null
}

type Channel = 'whatsapp' | 'instagram' | 'messenger' | 'other'

// Inboxes de Chatwoot de Sunrise → canal del CRM (respaldo cuando el payload
// no trae la cadena de canal explícita).
const INBOX_CHANNEL: Record<number, Channel> = {
  113656: 'whatsapp',
  116531: 'instagram',
  116606: 'messenger',
}

function channelFromString(s: string): Channel | '' {
  const l = s.toLowerCase()
  if (l.includes('whatsapp')) return 'whatsapp'
  if (l.includes('instagram')) return 'instagram'
  if (l.includes('facebook') || l.includes('messenger')) return 'messenger'
  return ''
}

const SOURCE_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', other: 'Chatwoot',
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  // --- Espejo del estado de la conversación (puente CRM → Botpress) ---------
  // Corre para TODOS los eventos, incluidos los conversation_* que los filtros
  // de mensaje descartan más abajo: son justo los que traen los cambios de
  // agente y de status. Va envuelto en try/catch porque este espejo nunca debe
  // tumbar el reflejo de mensajes, que es la función original del webhook.
  try {
    const parsed = stateFromWebhook(payload)
    if (parsed) {
      // Traza de diagnóstico del espejo: qué entendió el sync de este evento.
      console.log('[chatwoot-sync]', JSON.stringify({
        event: payload.event ?? null,
        conv: parsed.state.chatwoot_conversation_id,
        status: parsed.state.status,
        assigneeKnown: parsed.assigneeKnown,
        assignee_id: parsed.state.assignee_id,
        is_assigned: parsed.state.is_assigned,
      }))
      const convId = parsed.state.chatwoot_conversation_id
      const { data: known } = await supabase
        .from('chatwoot_conversations')
        .select('source_id, is_assigned')
        .eq('chatwoot_conversation_id', convId)
        .maybeSingle()

      await upsertConversationState(supabase, parsed.state, { assigneeKnown: parsed.assigneeKnown })

      // Enriquecimiento desde la API, solo cuando hace falta:
      //  * source_id (el id de Meta que ve Botpress) no viene en el webhook.
      //  * si el evento no reporta assignee y aún no conocemos la conversación,
      //    preguntamos en vez de asumir que está sin agente.
      const row = known as { source_id: string | null; is_assigned: boolean } | null
      const needsSourceId = parsed.state.channel !== 'whatsapp' &&
        !row?.source_id && parsed.state.chatwoot_contact_id != null
      const needsAssignee = !parsed.assigneeKnown && !row

      if (needsSourceId || needsAssignee) {
        const enrich = (async () => {
          const patch = { ...parsed.state }
          let assigneeKnown = parsed.assigneeKnown

          if (needsSourceId) {
            patch.source_id = await getContactSourceId(
              parsed.state.chatwoot_contact_id!,
              parsed.state.chatwoot_inbox_id,
            )
          }
          if (needsAssignee) {
            const fresh = await getConversation(convId)
            const freshState = fresh ? stateFromWebhook(fresh) : null
            if (freshState?.assigneeKnown) {
              patch.assignee_id = freshState.state.assignee_id
              patch.assignee_name = freshState.state.assignee_name
              patch.is_assigned = freshState.state.is_assigned
              patch.status = freshState.state.status ?? patch.status
              assigneeKnown = true
            }
          }
          await upsertConversationState(supabase, patch, { assigneeKnown })
        })()

        // En segundo plano: no sumar la latencia de la API de Chatwoot a la
        // respuesta del webhook (Chatwoot reintenta si tardamos demasiado).
        const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
        if (edge) edge.waitUntil(enrich)
        else await enrich
      }
    }
  } catch (err) {
    console.error('[chatwoot-webhook] sincronización de conversación falló:', err)
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
  let isBot = false
  if (messageType === 'outgoing' && senderType === 'user') {
    direction = 'outbound'
  } else if (messageType === 'outgoing' && (senderType === 'agent_bot' || senderType === null)) {
    // Respuestas del bot vía Chatwoot. En WhatsApp llegan como 'agent_bot';
    // en Instagram/Messenger el bot sale con sender_type null. Antes esas se
    // ignoraban y el hilo del CRM quedaba sin las respuestas del bot; se
    // reflejan como outbound marcadas con bot=true para que la UI las etiquete.
    direction = 'outbound'
    isBot = true
  } else if (messageType === 'incoming' && (senderType === null || senderType === 'contact')) {
    direction = 'inbound'
  } else {
    return ignored('message_type_sender')
  }

  // Detectar el canal (WhatsApp / Instagram / Messenger) desde el payload.
  const sender = payload.conversation?.meta?.sender ?? null
  const phoneRaw = sender?.phone_number ?? ''
  const phoneDigits = phoneRaw.replace(/\D/g, '')

  const inboxId = payload.conversation?.inbox_id ?? payload.inbox?.id ?? null
  let channel: Channel =
    channelFromString(String(payload.conversation?.channel ?? payload.channel ?? '')) ||
    (inboxId != null ? INBOX_CHANNEL[inboxId] : '') ||
    (phoneDigits ? 'whatsapp' : 'other')

  // Identidad canónica por canal. WhatsApp usa los dígitos del teléfono
  // (contrato compartido con botpress-webhook); el resto usa el identificador
  // del contacto de Chatwoot (Instagram/Messenger no tienen teléfono).
  let channelUserId: string
  if (channel === 'whatsapp') {
    if (!phoneDigits) return ignored('no_phone')
    channelUserId = phoneDigits
  } else {
    channelUserId = String(sender?.identifier ?? sender?.id ?? '')
    if (!channelUserId) return ignored('no_identifier')
  }

  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0
  const content = (payload.content?.trim() || (hasAttachments ? '[Adjunto]' : ''))
    .slice(0, CONTENT_MAX_LENGTH)
  if (!content) return ignored('empty_content')

  // Buscar el cliente por (canal, channel_user_id). Para WhatsApp hay un
  // respaldo por teléfono (contactos antiguos guardados con formato +503...).
  const idLog = channel === 'whatsapp' ? phoneRaw : `${channel}:${channelUserId}`
  let clientId: string | null = null
  const { data: byChannelId } = await supabase
    .from('clients')
    .select('id')
    .eq('channel', channel)
    .eq('channel_user_id', channelUserId)
    .maybeSingle()
  clientId = (byChannelId as { id: string } | null)?.id ?? null

  if (!clientId && channel === 'whatsapp' && phoneRaw) {
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', phoneRaw)
      .limit(1)
      .maybeSingle()
    clientId = (byPhone as { id: string } | null)?.id ?? null
  }

  // Un entrante de un contacto que el CRM no conoce crea un contacto mínimo NO
  // registrado (registered = false): así toda conversación aparece en la
  // bandeja aunque el bot nunca haya capturado datos, y el inbox muestra el
  // label "No registrado" con el botón "Agregar como cliente". Un saliente
  // hacia un desconocido sí se sigue ignorando: no hay conversación que mostrar.
  if (!clientId && direction === 'inbound') {
    const contactName = sender?.name?.trim() || null
    const { data: created, error: createError } = await supabase
      .from('clients')
      .insert({
        channel,
        channel_user_id: channelUserId,
        full_name: contactName ?? (phoneRaw || channelUserId),
        phone: channel === 'whatsapp' ? (phoneRaw || phoneDigits) : null,
        source: SOURCE_LABEL[channel],
        registered: false,
        last_contact_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (created) {
      clientId = (created as { id: string }).id
      console.log(`[chatwoot-webhook] contacto no registrado creado para ${idLog}: ${clientId}`)
    } else if ((createError as { code?: string } | null)?.code === '23505') {
      // Carrera con otro webhook concurrente: recuperar el que ganó.
      const { data: raced } = await supabase
        .from('clients')
        .select('id')
        .eq('channel', channel)
        .eq('channel_user_id', channelUserId)
        .maybeSingle()
      clientId = (raced as { id: string } | null)?.id ?? null
    } else {
      console.error('[chatwoot-webhook] error creando contacto no registrado:', createError)
    }
  }

  if (!clientId) {
    console.log(`[chatwoot-webhook] cliente no encontrado para ${idLog}`)
    return ignored('client_not_found')
  }

  // Enlazar la conversación espejada con el contacto del CRM, ahora que se
  // conoce. Best-effort: no debe impedir que se guarde el mensaje.
  const convIdForLink = payload.conversation?.id
  if (convIdForLink != null) {
    await supabase
      .from('chatwoot_conversations')
      .update({ client_id: clientId })
      .eq('chatwoot_conversation_id', convIdForLink)
      .is('client_id', null)
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
    channel,
    direction,
    content,
    raw_payload: {
      source: 'chatwoot',
      chatwoot_message_id: payload.id ?? null,
      chatwoot_conversation_id: payload.conversation?.id ?? null,
      agent_name: payload.sender?.name ?? null,
      ...(isBot ? { bot: true } : {}),
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
