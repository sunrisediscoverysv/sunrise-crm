import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface Conversation {
  client: {
    id: string
    full_name: string | null
    phone: string | null
    channel: string
    agent_last_read_at: string | null
  }
  lastMessage: {
    content: string | null
    direction: 'inbound' | 'outbound'
    created_at: string
  }
  lastInboundAt: string | null
  unread: boolean
}

// Límite de mensajes recientes que escaneamos para armar la bandeja. A la escala
// esperada del negocio (~cientos de conversaciones) es más que suficiente y evita
// una vista/RPC dedicada. Las conversaciones sin actividad reciente no aparecen.
const SCAN_LIMIT = 800

export function useInboxConversations() {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async (): Promise<Conversation[]> => {
      // 1) Mensajes recientes, del más nuevo al más viejo.
      // Nota: supabase-js@2.49.x infiere `never` en selects con proyección de
      // columnas bajo el generic Database; casteamos el resultado a un tipo local.
      type MsgRow = {
        client_id: string
        content: string | null
        direction: 'inbound' | 'outbound'
        created_at: string
      }
      const { data: rawMsgs, error } = await supabase
        .from('messages')
        .select('client_id, content, direction, created_at')
        .order('created_at', { ascending: false })
        .limit(SCAN_LIMIT)
      if (error) throw error
      const msgs = (rawMsgs ?? []) as unknown as MsgRow[]

      // 2) Agrupar por cliente conservando el orden (el más reciente primero).
      type Agg = {
        lastMessage: Conversation['lastMessage']
        lastInboundAt: string | null
      }
      const byClient = new Map<string, Agg>()
      for (const m of msgs) {
        const existing = byClient.get(m.client_id)
        if (!existing) {
          byClient.set(m.client_id, {
            lastMessage: { content: m.content, direction: m.direction, created_at: m.created_at },
            lastInboundAt: m.direction === 'inbound' ? m.created_at : null,
          })
        } else if (!existing.lastInboundAt && m.direction === 'inbound') {
          existing.lastInboundAt = m.created_at
        }
      }

      const ids = [...byClient.keys()]
      if (ids.length === 0) return []

      // 3) Datos de los clientes involucrados.
      const { data: rawClients, error: cErr } = await supabase
        .from('clients')
        .select('id, full_name, phone, channel, agent_last_read_at')
        .in('id', ids)
      if (cErr) throw cErr

      const clients = (rawClients ?? []) as unknown as Conversation['client'][]
      const clientById = new Map(clients.map(c => [c.id, c]))

      // 4) Componer conversaciones respetando el orden por mensaje más reciente.
      const conversations: Conversation[] = []
      for (const id of ids) {
        const client = clientById.get(id)
        const agg = byClient.get(id)
        if (!client || !agg) continue
        const unread =
          !!agg.lastInboundAt &&
          (!client.agent_last_read_at || agg.lastInboundAt > client.agent_last_read_at)
        conversations.push({
          client,
          lastMessage: agg.lastMessage,
          lastInboundAt: agg.lastInboundAt,
          unread,
        })
      }
      return conversations
    },
  })
}
