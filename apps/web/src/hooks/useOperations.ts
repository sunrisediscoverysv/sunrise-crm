import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Deal, Task, Payment } from '@/types/database'

export type DealWithRelations = Deal & {
  client: { full_name: string | null } | null
  property: { name: string } | null
  agent: { full_name: string } | null
}

export type TaskWithRelations = Task & {
  assignee: { full_name: string } | null
  client: { full_name: string | null } | null
}

export type PaymentWithRelations = Payment & {
  deal: { title: string } | null
  client: { full_name: string | null } | null
}

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async (): Promise<DealWithRelations[]> => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, client:clients(full_name), property:properties(name), agent:profiles(full_name)')
        .order('closed_at', { ascending: false })
      if (error) throw error
      return data as unknown as DealWithRelations[]
    },
    staleTime: 1000 * 30,
  })
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async (): Promise<TaskWithRelations[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignee:profiles(full_name), client:clients(full_name)')
        .order('status')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as unknown as TaskWithRelations[]
    },
    staleTime: 1000 * 30,
  })
}

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async (): Promise<PaymentWithRelations[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, deal:deals(title), client:clients(full_name)')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as unknown as PaymentWithRelations[]
    },
    staleTime: 1000 * 30,
  })
}
