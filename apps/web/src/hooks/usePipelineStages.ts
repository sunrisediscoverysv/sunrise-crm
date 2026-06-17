import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { PipelineStage } from '@/types/database'

export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .order('position')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 5, // stages rarely change
  })
}
