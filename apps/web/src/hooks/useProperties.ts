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
