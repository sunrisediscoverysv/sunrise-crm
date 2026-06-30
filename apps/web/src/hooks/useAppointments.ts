import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Appointment } from '@/types/database'

export type AppointmentWithRelations = Appointment & {
  clients: { id: string; full_name: string | null; phone: string | null; channel: string } | null
  profiles: { full_name: string; avatar_url: string | null } | null
}

const SELECT = `
  *,
  clients:client_id ( id, full_name, phone, channel ),
  profiles:assigned_to ( full_name, avatar_url )
`

export interface AppointmentRange {
  from: string // ISO
  to: string // ISO
}

// Citas dentro de un rango de fechas (para la vista de mes / agenda)
export function useAppointments(range: AppointmentRange) {
  return useQuery({
    queryKey: ['appointments', range.from, range.to],
    queryFn: async (): Promise<AppointmentWithRelations[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(SELECT)
        .gte('starts_at', range.from)
        .lte('starts_at', range.to)
        .order('starts_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as AppointmentWithRelations[]
    },
  })
}

// Citas de un cliente específico (para la ficha del cliente)
export function useClientAppointments(clientId: string) {
  return useQuery({
    queryKey: ['appointments', 'client', clientId],
    queryFn: async (): Promise<AppointmentWithRelations[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(SELECT)
        .eq('client_id', clientId)
        .order('starts_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AppointmentWithRelations[]
    },
    enabled: !!clientId,
  })
}
