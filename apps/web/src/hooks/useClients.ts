import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Client } from '@/types/database'

export interface ClientFilters {
  search?: string
  channel?: string
  stageId?: string
  assignedTo?: string
  from?: string
  to?: string
  registered?: 'yes' | 'no'
}

export type LinkedProperty = {
  id: string
  name: string
  price_label: string | null
  size_label: string | null
  location: string | null
  source_url: string | null
}

export type ClientWithProfile = Client & {
  profiles: { full_name: string; avatar_url: string | null } | null
  pipeline_stages: { name: string; color: string } | null
  property?: LinkedProperty | null
}

export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async (): Promise<ClientWithProfile[]> => {
      let query = supabase
        .from('clients')
        .select(`
          *,
          profiles:assigned_to ( full_name, avatar_url ),
          pipeline_stages:stage_id ( name, color )
        `)
        .order('created_at', { ascending: false })

      if (filters.channel) query = query.eq('channel', filters.channel)
      if (filters.stageId) query = query.eq('stage_id', filters.stageId)
      if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
      if (filters.from) query = query.gte('created_at', filters.from)
      if (filters.to) query = query.lte('created_at', filters.to)
      if (filters.registered) query = query.eq('registered', filters.registered === 'yes')

      if (filters.search) {
        const s = `%${filters.search}%`
        query = query.or(`full_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ClientWithProfile[]
    },
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async (): Promise<ClientWithProfile | null> => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          profiles:assigned_to ( full_name, avatar_url ),
          pipeline_stages:stage_id ( name, color ),
          property:property_id ( id, name, price_label, size_label, location, source_url )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as ClientWithProfile
    },
    enabled: !!id,
  })
}
