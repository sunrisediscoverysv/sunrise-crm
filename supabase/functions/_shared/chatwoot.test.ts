// Casos A–E del contrato con Botpress. Lógica pura: sin red ni base de datos.
//   deno test supabase/functions/_shared/chatwoot.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  computeHandoff,
  isResolved,
  normalizeChatwootAttachments,
  phoneDigits,
  pickRelevantConversation,
  stateFromWebhook,
} from './chatwoot.ts'

const IG_INBOX = 116531
const AGENT_ID = 184155

function igWebhook(opts: {
  convId: number
  status: string
  assignee?: { id: number; available_name: string } | null
  senderId?: number
  identifier?: string | null
  withAssigneeKey?: boolean
}) {
  const meta: Record<string, unknown> = {
    sender: { id: opts.senderId ?? 906573498, identifier: opts.identifier ?? null },
  }
  if (opts.withAssigneeKey !== false) meta.assignee = opts.assignee ?? null
  return {
    event: 'conversation_updated',
    id: opts.convId,
    status: opts.status,
    inbox_id: IG_INBOX,
    meta,
  }
}

Deno.test('Caso A — Instagram sin agente, status open → handoff false', () => {
  const parsed = stateFromWebhook(igWebhook({ convId: 123456, status: 'open', assignee: null }))!
  assertEquals(parsed.state.channel, 'instagram')
  assertEquals(parsed.state.is_assigned, false)
  assertEquals(parsed.assigneeKnown, true)
  assertEquals(computeHandoff(parsed.state), false)
})

Deno.test('Caso B — Instagram con agente, status open → handoff true', () => {
  const parsed = stateFromWebhook(
    igWebhook({
      convId: 123456,
      status: 'open',
      assignee: { id: AGENT_ID, available_name: 'Agente Demo' },
    }),
  )!
  assertEquals(parsed.state.is_assigned, true)
  assertEquals(parsed.state.assignee_id, AGENT_ID)
  assertEquals(parsed.state.assignee_name, 'Agente Demo')
  assertEquals(computeHandoff(parsed.state), true)
})

Deno.test('Caso C — conversación resuelta con agente → handoff false', () => {
  const parsed = stateFromWebhook(
    igWebhook({
      convId: 123456,
      status: 'resolved',
      assignee: { id: AGENT_ID, available_name: 'Agente Demo' },
    }),
  )!
  assertEquals(parsed.state.is_assigned, true)
  assertEquals(isResolved(parsed.state.status), true)
  assertEquals(computeHandoff(parsed.state), false)
})

Deno.test('Caso D — usuario inexistente → no hay conversación que elegir', () => {
  assertEquals(pickRelevantConversation([]), null)
})

Deno.test('Caso E — Messenger usa la misma lógica y su propio inbox', () => {
  const parsed = stateFromWebhook({
    event: 'conversation_updated',
    id: 987654,
    status: 'open',
    inbox_id: 116606,
    meta: {
      sender: { id: 906456687, identifier: '9876543210987654' },
      assignee: { id: AGENT_ID, available_name: 'Agente Demo' },
    },
  })!
  assertEquals(parsed.state.channel, 'messenger')
  assertEquals(parsed.state.contact_identifier, '9876543210987654')
  assertEquals(computeHandoff(parsed.state), true)
})

Deno.test('assignee ausente no cuenta como desasignación', () => {
  // message_created sin la clave `assignee`: no debe borrar el agente guardado.
  const parsed = stateFromWebhook(
    igWebhook({ convId: 123456, status: 'open', withAssigneeKey: false }),
  )!
  assertEquals(parsed.assigneeKnown, false)
})

Deno.test('varias conversaciones: gana la activa aunque haya una resuelta más nueva', () => {
  const chosen = pickRelevantConversation([
    { chatwoot_conversation_id: 1, status: 'resolved', last_event_at: '2026-08-12T20:00:00Z' },
    { chatwoot_conversation_id: 2, status: 'open', last_event_at: '2026-08-12T18:00:00Z' },
  ])
  assertEquals(chosen?.chatwoot_conversation_id, 2)
})

Deno.test('varias activas: gana la más reciente', () => {
  const chosen = pickRelevantConversation([
    { chatwoot_conversation_id: 1, status: 'pending', last_event_at: '2026-08-12T18:00:00Z' },
    { chatwoot_conversation_id: 2, status: 'open', last_event_at: '2026-08-12T20:00:00Z' },
  ])
  assertEquals(chosen?.chatwoot_conversation_id, 2)
})

Deno.test('solo resueltas → se elige la más reciente y handoff queda en false', () => {
  const chosen = pickRelevantConversation([
    { chatwoot_conversation_id: 1, status: 'resolved', last_event_at: '2026-08-11T10:00:00Z' },
    { chatwoot_conversation_id: 2, status: 'resolved', last_event_at: '2026-08-12T10:00:00Z' },
  ])!
  assertEquals(chosen.chatwoot_conversation_id, 2)
  assertEquals(
    computeHandoff({ is_assigned: true, assignee_id: AGENT_ID, status: chosen.status }),
    false,
  )
})

Deno.test('WhatsApp: el teléfono se normaliza a dígitos', () => {
  assertEquals(phoneDigits('+503 7777 0000'), '50377770000')
  assertEquals(phoneDigits('50377770000'), '50377770000')
  assertEquals(phoneDigits(null), '')
})

Deno.test('WhatsApp: el canal se deduce del teléfono cuando no hay inbox conocido', () => {
  const parsed = stateFromWebhook({
    event: 'conversation_updated',
    id: 555,
    status: 'open',
    meta: { sender: { id: 1, phone_number: '+50377770000' }, assignee: null },
  })!
  assertEquals(parsed.state.channel, 'whatsapp')
  assertEquals(parsed.state.phone_digits, '50377770000')
})

Deno.test('is_assigned true pero assignee_id nulo no dispara handoff', () => {
  assertEquals(computeHandoff({ is_assigned: true, assignee_id: null, status: 'open' }), false)
})

Deno.test('Adjuntos de Chatwoot: tipo, nombre y tamaño', () => {
  const out = normalizeChatwootAttachments([
    {
      file_type: 'image',
      data_url: 'https://app.chatwoot.com/rails/active_storage/blobs/redirect/abc/Foto%20casa.jpg',
      thumb_url: 'https://app.chatwoot.com/thumb.jpg',
      file_size: 2048,
    },
    { file_type: 'file', data_url: 'https://app.chatwoot.com/x/ficha.pdf', file_size: null },
    { file_type: 'audio', data_url: 'https://app.chatwoot.com/x/nota.ogg', thumb_url: '' },
  ])
  assertEquals(out.map(a => a.kind), ['image', 'document', 'audio'])
  assertEquals(out[0].file_name, 'Foto casa.jpg')
  assertEquals(out[0].size, 2048)
  assertEquals(out[1].size, 0)
  assertEquals(out[2].thumb_url, null)
})

Deno.test('Adjuntos de Chatwoot: sin archivo o forma rara se descartan', () => {
  assertEquals(normalizeChatwootAttachments(null), [])
  assertEquals(normalizeChatwootAttachments([{ file_type: 'location', coordinates_lat: 13.7 }]), [])
  assertEquals(normalizeChatwootAttachments([{ file_type: 'story_mention', data_url: 'https://x/y' }])[0].kind, 'document')
})
