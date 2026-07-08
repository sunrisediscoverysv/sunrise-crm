import { supabase } from './supabaseClient'
import type {
  ClientInsert,
  ClientUpdate,
  ClientCommentInsert,
  StageHistoryInsert,
  PropertyInsert,
  AppointmentInsert,
  AppointmentUpdate,
  DealInsert,
  DealUpdate,
  TaskInsert,
  TaskUpdate,
  PaymentInsert,
  PaymentUpdate,
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
type ClientAttachmentInsert = Database['public']['Tables']['client_attachments']['Insert']
type PushSubscriptionInsert = Database['public']['Tables']['push_subscriptions']['Insert']

// ── Attachment mutations ─────────────────────────────────────────────────────

export async function addClientAttachment(values: ClientAttachmentInsert): Promise<void> {
  const { error } = await raw.from('client_attachments').insert(values)
  if (error) throw new Error(error.message)
}

// ── Push subscriptions ───────────────────────────────────────────────────────

export async function addPushSubscription(values: PushSubscriptionInsert): Promise<void> {
  const { error } = await raw.from('push_subscriptions').upsert(values, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

// ── Team / user mutations ────────────────────────────────────────────────────

export type NewUserRole = 'admin' | 'agente' | 'visor'

export interface NewUserInput {
  email: string
  password: string
  full_name: string
  role: NewUserRole
}

/** Creates an auth account + profile via the admin-create-user edge function. */
export async function createUser(input: NewUserInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input })
  if (error) {
    // Surface the JSON { error } message returned by the function on 4xx/5xx.
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') msg = (await ctx.json())?.error ?? msg
    } catch { /* keep default message */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
}

export async function updateProfileRole(id: string, role: NewUserRole): Promise<void> {
  const { error } = await raw.from('profiles').update({ role }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Property mutations ───────────────────────────────────────────────────────

export async function createProperty(values: PropertyInsert): Promise<void> {
  const { error } = await raw.from('properties').insert(values)
  if (error) throw new Error(error.message)
}

export async function updatePropertyStatus(id: string, status: Database['public']['Tables']['properties']['Row']['status']): Promise<void> {
  const { error } = await raw.from('properties').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

// clients.property_id has ON DELETE SET NULL, so interested leads are unlinked automatically.
export async function deleteProperty(id: string): Promise<void> {
  const { error } = await raw.from('properties').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Client mutations ──────────────────────────────────────────────────────────

export async function createClient(values: Omit<ClientInsert, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  const { data, error } = await raw.from('clients').insert(values).select('id').single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await raw.from('clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

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

// ── Appointment mutations (calendario) ───────────────────────────────────────

export async function createAppointment(values: AppointmentInsert): Promise<string> {
  const { data, error } = await raw.from('appointments').insert(values).select('id').single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function updateAppointment(id: string, values: AppointmentUpdate): Promise<void> {
  const { error } = await raw.from('appointments').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await raw.from('appointments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Operations: deals / tasks / payments ─────────────────────────────────────

export async function createDeal(values: DealInsert): Promise<void> {
  const { error } = await raw.from('deals').insert(values)
  if (error) throw new Error(error.message)
}
export async function updateDeal(id: string, values: DealUpdate): Promise<void> {
  const { error } = await raw.from('deals').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}
export async function deleteDeal(id: string): Promise<void> {
  const { error } = await raw.from('deals').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createTask(values: TaskInsert): Promise<void> {
  const { error } = await raw.from('tasks').insert(values)
  if (error) throw new Error(error.message)
}
export async function updateTask(id: string, values: TaskUpdate): Promise<void> {
  const { error } = await raw.from('tasks').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}
export async function deleteTask(id: string): Promise<void> {
  const { error } = await raw.from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createPayment(values: PaymentInsert): Promise<void> {
  const { error } = await raw.from('payments').insert(values)
  if (error) throw new Error(error.message)
}
export async function updatePayment(id: string, values: PaymentUpdate): Promise<void> {
  const { error } = await raw.from('payments').update(values).eq('id', id)
  if (error) throw new Error(error.message)
}
export async function deletePayment(id: string): Promise<void> {
  const { error } = await raw.from('payments').delete().eq('id', id)
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
