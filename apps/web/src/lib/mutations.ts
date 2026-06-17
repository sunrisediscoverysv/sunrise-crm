import { supabase } from './supabaseClient'
import type {
  ClientUpdate,
  ClientCommentInsert,
  StageHistoryInsert,
} from '@/types/database'
import type { Database } from '@/types/database'

// @supabase/supabase-js@2.49.x has a known inference bug: mutation builders
// (.update()/.insert()) resolve their parameter types as `never` when used with
// a custom Database generic. This module is the single containment point for
// that cast — all callers get clean typed signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = supabase as any

type PipelineStageRow = Database['public']['Tables']['pipeline_stages']['Row']
type PipelineStageInsert = Database['public']['Tables']['pipeline_stages']['Insert']
type PipelineStageUpdate = Database['public']['Tables']['pipeline_stages']['Update']

// ── Client mutations ──────────────────────────────────────────────────────────

export async function updateClient(id: string, values: ClientUpdate): Promise<void> {
  const { error } = await raw.from('clients').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function moveClientToStage(
  clientId: string,
  toStageId: string,
  fromStageId: string | null,
  changedBy: string | null,
): Promise<void> {
  const { error: clientErr } = await raw
    .from('clients')
    .update({ stage_id: toStageId } satisfies ClientUpdate)
    .eq('id', clientId)
  if (clientErr) throw new Error(clientErr.message)

  const { error: histErr } = await raw
    .from('stage_history')
    .insert({
      client_id: clientId,
      to_stage_id: toStageId,
      from_stage_id: fromStageId,
      changed_by: changedBy,
    } satisfies StageHistoryInsert)
  if (histErr) throw new Error(histErr.message)
}

export async function addComment(values: ClientCommentInsert): Promise<void> {
  const { error } = await raw.from('client_comments').insert(values)
  if (error) throw new Error(error.message)
}

// ── Pipeline stage mutations (admin) ─────────────────────────────────────────

export async function createStage(
  values: Omit<PipelineStageInsert, 'id' | 'created_at'>,
): Promise<PipelineStageRow> {
  const { data, error } = await raw.from('pipeline_stages').insert(values).select().single()
  if (error) throw new Error(error.message)
  return data as PipelineStageRow
}

export async function updateStage(id: string, values: PipelineStageUpdate): Promise<void> {
  const { error } = await raw.from('pipeline_stages').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await raw.from('pipeline_stages').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function reorderStages(
  stages: { id: string; position: number }[],
): Promise<void> {
  await Promise.all(
    stages.map(({ id, position }) =>
      raw.from('pipeline_stages').update({ position }).eq('id', id),
    ),
  )
}
