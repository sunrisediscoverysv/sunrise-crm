import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock de supabase-js ───────────────────────────────────────────────────────
// Cada operación (insert/update/delete/select) devuelve un "thenable" encadenable
// que resuelve a { data, error }, igual que el query builder real.

type Result = { data?: unknown; error?: { message: string } | null }

interface Call { table: string; op: string; payload?: unknown; eq?: [string, unknown] }

const calls: Call[] = []
let nextResults: Result[] = []

function shiftResult(): Result {
  return nextResults.shift() ?? { data: null, error: null }
}

function builder(table: string, op: string, payload?: unknown) {
  const call: Call = { table, op, payload }
  calls.push(call)
  const chain = {
    eq(col: string, val: unknown) { call.eq = [col, val]; return chain },
    select() { return chain },
    single() { return chain },
    then(resolve: (r: Result) => unknown) { return Promise.resolve(shiftResult()).then(resolve) },
  }
  return chain
}

const supabaseMock = {
  from: (table: string) => ({
    insert: (v: unknown) => builder(table, 'insert', v),
    update: (v: unknown) => builder(table, 'update', v),
    upsert: (v: unknown) => builder(table, 'upsert', v),
    delete: () => builder(table, 'delete'),
    select: (v: unknown) => builder(table, 'select', v),
  }),
  functions: { invoke: vi.fn() },
}

vi.mock('./supabaseClient', () => ({ supabase: supabaseMock }))

const {
  moveClientToStage,
  reorderStages,
  createClient,
  deleteProperty,
  updateProfileRole,
} = await import('./mutations')

beforeEach(() => {
  calls.length = 0
  nextResults = []
})

// ── moveClientToStage ────────────────────────────────────────────────────────

describe('moveClientToStage', () => {
  it('actualiza el cliente y registra el historial en ese orden', async () => {
    await moveClientToStage('cli-1', 'stage-b', 'stage-a', 'user-1')

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      table: 'clients',
      op: 'update',
      payload: { stage_id: 'stage-b' },
      eq: ['id', 'cli-1'],
    })
    expect(calls[1]).toMatchObject({
      table: 'stage_history',
      op: 'insert',
      payload: {
        client_id: 'cli-1',
        to_stage_id: 'stage-b',
        from_stage_id: 'stage-a',
        changed_by: 'user-1',
      },
    })
  })

  it('acepta from_stage_id nulo (lead que entra directo a una etapa)', async () => {
    await moveClientToStage('cli-1', 'stage-a', null, null)
    expect(calls[1].payload).toMatchObject({ from_stage_id: null, changed_by: null })
  })

  it('lanza y NO escribe historial si falla el update del cliente', async () => {
    nextResults = [{ error: { message: 'RLS denied' } }]
    await expect(moveClientToStage('cli-1', 'b', 'a', 'u')).rejects.toThrow('RLS denied')
    expect(calls.filter(c => c.table === 'stage_history')).toHaveLength(0)
  })

  it('lanza si falla el insert del historial', async () => {
    nextResults = [{ error: null }, { error: { message: 'fk violation' } }]
    await expect(moveClientToStage('cli-1', 'b', 'a', 'u')).rejects.toThrow('fk violation')
  })
})

// ── reorderStages ────────────────────────────────────────────────────────────

describe('reorderStages', () => {
  it('envía un update de position por cada etapa', async () => {
    await reorderStages([
      { id: 's1', position: 0 },
      { id: 's2', position: 1 },
      { id: 's3', position: 2 },
    ])
    expect(calls).toHaveLength(3)
    expect(calls[0]).toMatchObject({ table: 'pipeline_stages', op: 'update', payload: { position: 0 }, eq: ['id', 's1'] })
    expect(calls[2]).toMatchObject({ payload: { position: 2 }, eq: ['id', 's3'] })
  })

  it('no hace nada con una lista vacía', async () => {
    await reorderStages([])
    expect(calls).toHaveLength(0)
  })

  it('lanza cuando alguno de los updates falla (no puede fallar en silencio)', async () => {
    nextResults = [
      { error: null },
      { error: { message: 'permission denied for table pipeline_stages' } },
      { error: null },
    ]
    await expect(
      reorderStages([
        { id: 's1', position: 0 },
        { id: 's2', position: 1 },
        { id: 's3', position: 2 },
      ]),
    ).rejects.toThrow('permission denied for table pipeline_stages')
  })
})

// ── Mutaciones simples ───────────────────────────────────────────────────────

describe('createClient', () => {
  it('devuelve el id del cliente creado', async () => {
    nextResults = [{ data: { id: 'nuevo-id' }, error: null }]
    await expect(createClient({ full_name: 'Ana' } as never)).resolves.toBe('nuevo-id')
  })

  it('propaga el error de la base como Error', async () => {
    nextResults = [{ error: { message: 'duplicate key' } }]
    await expect(createClient({ full_name: 'Ana' } as never)).rejects.toThrow('duplicate key')
  })
})

describe('deleteProperty', () => {
  it('borra por id', async () => {
    await deleteProperty('prop-9')
    expect(calls[0]).toMatchObject({ table: 'properties', op: 'delete', eq: ['id', 'prop-9'] })
  })
})

describe('updateProfileRole', () => {
  it('actualiza el rol del perfil', async () => {
    await updateProfileRole('user-3', 'admin')
    expect(calls[0]).toMatchObject({ table: 'profiles', op: 'update', payload: { role: 'admin' }, eq: ['id', 'user-3'] })
  })

  it('propaga el error de RLS', async () => {
    nextResults = [{ error: { message: 'not allowed' } }]
    await expect(updateProfileRole('user-3', 'admin')).rejects.toThrow('not allowed')
  })
})
