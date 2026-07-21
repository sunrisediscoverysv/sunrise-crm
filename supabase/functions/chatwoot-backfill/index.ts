// Backfill de un solo uso: importa el historial de conversaciones de
// Instagram/Messenger desde Chatwoot al CRM. Protegida por x-backfill-secret.
// Fusiona con los contactos que Botpress ya creó, emparejando por nombre.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// Inbox de Chatwoot → canal del CRM.
const INBOXES: { inbox: number; channel: 'instagram' | 'messenger'; source: string }[] = [
  { inbox: 116531, channel: 'instagram', source: 'Instagram' },
  { inbox: 116606, channel: 'messenger', source: 'Messenger' },
]

const CONTENT_MAX = 4000

Deno.serve(async (req) => {
  if (req.headers.get('x-backfill-secret') !== env('BACKFILL_SECRET') || !env('BACKFILL_SECRET')) {
    return json({ error: 'No autorizado' }, 401)
  }

  const base = env('CHATWOOT_BASE_URL').replace(/\/$/, '')
  const account = env('CHATWOOT_ACCOUNT_ID')
  const apiToken = env('CHATWOOT_API_TOKEN')
  const cw = (path: string) => fetch(`${base}/api/v1/accounts/${account}${path}`, { headers: { api_access_token: apiToken } })

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

  const report: Record<string, unknown> = { conversations: 0, messages_inserted: 0, clients_created: 0, clients_merged: 0, details: [] as unknown[] }

  for (const { inbox, channel, source } of INBOXES) {
    // Recorrer todas las páginas de conversaciones del inbox.
    for (let page = 1; page < 20; page++) {
      const res = await cw(`/conversations?inbox_id=${inbox}&status=all&page=${page}`)
      if (!res.ok) break
      const body = await res.json()
      const convs = body?.data?.payload ?? []
      if (convs.length === 0) break

      for (const conv of convs) {
        report.conversations = (report.conversations as number) + 1
        const convId = conv.id
        const sender = conv?.meta?.sender ?? {}
        const contactId = String(sender.id ?? '')
        const name = (sender.name ?? '').toString().trim() || null
        if (!contactId) continue

        // Resolver cliente: 1) por (canal, id de contacto de Chatwoot);
        // 2) fusionar por nombre con el contacto de Botpress (adoptando su id);
        // 3) crear nuevo.
        let clientId: string | null = null
        const { data: byId } = await admin.from('clients').select('id').eq('channel', channel).eq('channel_user_id', contactId).maybeSingle()
        clientId = (byId as { id: string } | null)?.id ?? null

        if (!clientId && name) {
          const { data: byName } = await admin.from('clients').select('id').eq('channel', channel).eq('full_name', name).limit(1).maybeSingle()
          const found = (byName as { id: string } | null)?.id ?? null
          if (found) {
            await admin.from('clients').update({ channel_user_id: contactId }).eq('id', found)
            clientId = found
            report.clients_merged = (report.clients_merged as number) + 1
          }
        }

        if (!clientId) {
          const { data: created } = await admin.from('clients').insert({
            channel, channel_user_id: contactId, full_name: name ?? contactId,
            source, registered: false, last_contact_at: new Date().toISOString(),
          }).select('id').single()
          clientId = (created as { id: string } | null)?.id ?? null
          if (clientId) report.clients_created = (report.clients_created as number) + 1
        }
        if (!clientId) continue

        // Traer los mensajes de la conversación (paginando hacia atrás).
        const seen = new Set<number>()
        let before: number | null = null
        for (let p = 0; p < 15; p++) {
          const mres = await cw(`/conversations/${convId}/messages${before ? `?before=${before}` : ''}`)
          if (!mres.ok) break
          const mbody = await mres.json()
          const msgs = mbody?.payload ?? []
          if (msgs.length === 0) break
          before = msgs[0]?.id ?? null

          for (const m of msgs) {
            if (seen.has(m.id)) continue
            seen.add(m.id)
            if (m.private === true) continue
            const mt = m.message_type // 0 incoming, 1 outgoing, 2 activity, 3 template
            let direction: 'inbound' | 'outbound' | null = null
            if (mt === 0) direction = 'inbound'
            else if (mt === 1) direction = 'outbound'
            else continue

            const hasAtt = Array.isArray(m.attachments) && m.attachments.length > 0
            const content = ((m.content ?? '').toString().trim() || (hasAtt ? '[Adjunto]' : '')).slice(0, CONTENT_MAX)
            if (!content) continue

            // Dedup por chatwoot_message_id.
            const { data: dupe } = await admin.from('messages').select('id')
              .eq('client_id', clientId).eq('raw_payload->>chatwoot_message_id', String(m.id)).limit(1).maybeSingle()
            if (dupe) continue

            const createdAt = m.created_at ? new Date(m.created_at * 1000).toISOString() : new Date().toISOString()
            const isBot = (m.sender?.type ?? '').toLowerCase() === 'agent_bot'
            const { error: insErr } = await admin.from('messages').insert({
              client_id: clientId, channel, direction, content, created_at: createdAt,
              raw_payload: {
                source: 'chatwoot', backfill: true,
                chatwoot_message_id: m.id, chatwoot_conversation_id: convId,
                agent_name: direction === 'outbound' ? (m.sender?.name ?? null) : null,
                ...(isBot ? { bot: true } : {}),
              },
            })
            if (!insErr) report.messages_inserted = (report.messages_inserted as number) + 1
          }
          if (msgs.length < 20) break
        }

        // last_contact_at = último mensaje de la conversación.
        await admin.from('clients').update({ last_contact_at: new Date().toISOString() }).eq('id', clientId)
        ;(report.details as unknown[]).push({ channel, convId, contact: name, contactId, clientId })
      }
    }
  }

  return json({ ok: true, ...report })
})
