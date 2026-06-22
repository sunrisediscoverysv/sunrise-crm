import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Client } from '@/types/database'

export interface ClientFilters {
  search?: string
  channel?: string
  stageId?: string
  assignedTo?: string
  from?: string
  to?: string
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

const CLIENT_SELECT = `
  *,
  profiles:assigned_to ( full_name, avatar_url ),
  pipeline_stages:stage_id ( name, color )
`

/** Aplica los filtros comunes a un query de clientes (reutilizado por todas las variantes). */
function applyFilters<T>(query: T, filters: ClientFilters): T {
  // @ts-expect-error: el builder de Supabase encadena y conserva el tipo en runtime
  let q = query.order('created_at', { ascending: false })
  if (filters.channel) q = q.eq('channel', filters.channel)
  if (filters.stageId) q = q.eq('stage_id', filters.stageId)
  if (filters.assignedTo) q = q.eq('assigned_to', filters.assignedTo)
  if (filters.from) q = q.gte('created_at', filters.from)
  if (filters.to) q = q.lte('created_at', filters.to)
  if (filters.search) {
    const s = `%${filters.search}%`
    q = q.or(`full_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`)
  }
  return q
}

/** Trae TODOS los clientes que coinciden con los filtros (sin paginar).
 *  Usado por el Pipeline (tablero) y la búsqueda global. */
export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async (): Promise<ClientWithProfile[]> => {
      const query = applyFilters(supabase.from('clients').select(CLIENT_SELECT), filters)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ClientWithProfile[]
    },
  })
}

export interface PaginatedClients {
  rows: ClientWithProfile[]
  total: number
}

/** Lista de clientes paginada del lado del servidor (pantalla de Clientes).
 *  Evita traer miles de filas de golpe. `page` es 0-based. */
export function useClientsPaginated(filters: ClientFilters, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['clients', 'paginated', filters, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PaginatedClients> => {
      const from = page * pageSize
      const to = from + pageSize - 1
      const query = applyFilters(
        supabase.from('clients').select(CLIENT_SELECT, { count: 'exact' }),
        filters,
      ).range(from, to)
      const { data, error, count } = await query
      if (error) throw error
      return { rows: (data ?? []) as ClientWithProfile[], total: count ?? 0 }
    },
  })
}

/** Descarga todos los clientes que coinciden con los filtros (para exportar a CSV).
 *  No usa caché de React Query: es una acción puntual al hacer clic. */
export async function fetchClientsForExport(filters: ClientFilters): Promise<ClientWithProfile[]> {
  const query = applyFilters(supabase.from('clients').select(CLIENT_SELECT), filters)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ClientWithProfile[]
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
