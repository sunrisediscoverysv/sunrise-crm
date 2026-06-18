import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Property } from '@/types/database'

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async (): Promise<Property[]> => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('price_usd', { ascending: true, nullsFirst: false })
        .order('name')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}

/** Cantidad de leads vinculados a cada propiedad: { [propertyId]: count }. */
export function usePropertyLeadCounts() {
  return useQuery({
    queryKey: ['property-lead-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('clients')
        .select('property_id')
        .not('property_id', 'is', null)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as { property_id: string | null }[]) {
        if (row.property_id) counts[row.property_id] = (counts[row.property_id] ?? 0) + 1
      }
      return counts
    },
    staleTime: 1000 * 60,
  })
}
