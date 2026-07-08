import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface StandbyDetail {
  firstAt: string | null       // inicio de la conversación (primer mensaje)
  lastAt: string | null        // última interacción (último mensaje)
  lastDirection: 'inbound' | 'outbound' | null // quién escribió al final
  comment: string | null       // comentario interno más reciente
}

// Para los leads congelados: fecha de inicio, última interacción, quién
// contestó último y el último comentario. Una sola consulta por tabla.
export function useStandbyDetails(clientIds: string[]) {
  const key = [...clientIds].sort().join(',')
  return useQuery({
    queryKey: ['standby-details', key],
    enabled: clientIds.length > 0,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<Record<string, StandbyDetail>> => {
      const out: Record<string, StandbyDetail> = {}
      for (const id of clientIds) out[id] = { firstAt: null, lastAt: null, lastDirection: null, comment: null }

      const { data: msgs, error: mErr } = await supabase
        .from('messages')
        .select('client_id, created_at, direction')
        .in('client_id', clientIds)
        .order('created_at', { ascending: true })
      if (mErr) throw mErr
      for (const m of (msgs ?? []) as { client_id: string; created_at: string; direction: 'inbound' | 'outbound' }[]) {
        const d = out[m.client_id]
        if (!d) continue
        if (!d.firstAt) d.firstAt = m.created_at
        d.lastAt = m.created_at
        d.lastDirection = m.direction
      }

      const { data: comments, error: cErr } = await supabase
        .from('client_comments')
        .select('client_id, content, created_at')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
      if (cErr) throw cErr
      for (const c of (comments ?? []) as { client_id: string; content: string }[]) {
        const d = out[c.client_id]
        if (d && !d.comment) d.comment = c.content
      }

      return out
    },
  })
}
