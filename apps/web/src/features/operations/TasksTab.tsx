import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isPast, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTasks } from '@/hooks/useOperations'
import { useClients } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { useAuth } from '@/features/auth/AuthContext'
import { createTask, updateTask, deleteTask } from '@/lib/mutations'
import { TASK_PRIORITY } from './operationsMeta'
import { OpsModal, Field, AddButton, RowDelete, INPUT } from './OpsUI'

const EMPTY_FORM = { title: '', description: '', assigned_to: '', client_id: '', due_date: '', priority: 'medium' }

export function TasksTab() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: clients = [] } = useClients()
  const { data: agents = [] } = useProfiles()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')),
    [clients],
  )

  const pending = tasks.filter(t => t.status !== 'done')
  const done = tasks.filter(t => t.status === 'done')
  const visible = showDone ? done : pending

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })

  const createMut = useMutation({
    mutationFn: () => createTask({
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      client_id: form.client_id || null,
      due_date: form.due_date || null,
      priority: form.priority as 'low' | 'medium' | 'high',
      created_by: user?.id ?? null,
    }),
    onSuccess: () => { invalidate(); setOpen(false); setForm(EMPTY_FORM); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => updateTask(id, { status: done ? 'done' : 'pending' }),
    onSuccess: invalidate,
    onError: (e: Error) => alert(`No se pudo actualizar: ${e.message}`),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => { invalidate(); setConfirmId(null) },
    onError: (e: Error) => alert(`No se pudo eliminar: ${e.message}`),
  })

  function submit() {
    setError(null)
    if (!form.title.trim()) return setError('Escribe qué hay que hacer.')
    createMut.mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="inline-flex p-0.5 bg-brand-light-gray/60 rounded-button">
          {[false, true].map(v => (
            <button
              key={String(v)}
              onClick={() => setShowDone(v)}
              className={[
                'px-3.5 py-1.5 text-sm font-sans font-medium rounded-[6px] transition-colors',
                showDone === v ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-charcoal/55 hover:text-brand-dark',
              ].join(' ')}
            >
              {v ? `Completadas (${done.length})` : `Pendientes (${pending.length})`}
            </button>
          ))}
        </div>
        <AddButton label="Nueva tarea" onClick={() => { setForm(EMPTY_FORM); setError(null); setOpen(true) }} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-brand-light-gray rounded-card animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-card shadow-card py-12 text-center">
          <p className="text-sm text-brand-charcoal/45 font-sans">
            {showDone ? 'Todavía no hay tareas completadas.' : '🎉 No hay tareas pendientes.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card divide-y divide-brand-light-gray/70">
          {visible.map(t => {
            const pr = TASK_PRIORITY[t.priority]
            const isDone = t.status === 'done'
            const due = t.due_date ? new Date(t.due_date + 'T00:00:00') : null
            const overdue = due && !isDone && isPast(due) && !isToday(due)
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                {/* Toggle completar */}
                <button
                  onClick={() => toggleMut.mutate({ id: t.id, done: !isDone })}
                  disabled={toggleMut.isPending}
                  className={[
                    'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    isDone ? 'bg-brand-teal border-brand-teal text-white' : 'border-brand-charcoal/25 hover:border-brand-teal',
                  ].join(' ')}
                  title={isDone ? 'Marcar pendiente' : 'Marcar completada'}
                >
                  {isDone && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-sans font-semibold ${isDone ? 'text-brand-charcoal/40 line-through' : 'text-brand-dark'}`}>
                      {t.title}
                    </p>
                    <span className={`text-[10px] font-sans font-medium px-1.5 py-px rounded-pill ${pr.bg}`}>{pr.label}</span>
                    {overdue && (
                      <span className="text-[10px] font-sans font-medium px-1.5 py-px rounded-pill bg-red-50 text-red-600">Vencida</span>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-brand-charcoal/55 font-sans mt-0.5">{t.description}</p>}
                  <p className="text-[11px] text-brand-charcoal/45 font-sans mt-1">
                    {t.assignee?.full_name && <span>👤 {t.assignee.full_name.split(' ')[0]}</span>}
                    {t.client && (
                      <span>{t.assignee ? ' · ' : ''}
                        <Link to={`/clients/${t.client_id}`} className="hover:text-brand-teal transition-colors">
                          {t.client.full_name ?? 'Cliente'}
                        </Link>
                      </span>
                    )}
                    {due && (
                      <span className={overdue ? 'text-red-500 font-medium' : ''}>
                        {(t.assignee || t.client) ? ' · ' : ''}📅 {format(due, 'd MMM', { locale: es })}
                      </span>
                    )}
                  </p>
                </div>

                <RowDelete
                  confirming={confirmId === t.id}
                  onAsk={() => setConfirmId(t.id)}
                  onConfirm={() => delMut.mutate(t.id)}
                  onCancel={() => setConfirmId(null)}
                  busy={delMut.isPending}
                />
              </div>
            )
          })}
        </div>
      )}

      <OpsModal open={open} title="Nueva tarea" onClose={() => setOpen(false)} onSubmit={submit} saving={createMut.isPending} error={error} submitLabel="Crear tarea">
        <Field label="¿Qué hay que hacer?">
          <input className={INPUT} autoFocus placeholder="Ej. Llamar a Fran para confirmar la visita" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Detalles (opcional)">
          <textarea className={INPUT + ' min-h-[64px] resize-y'} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asignar a">
            <select className={INPUT} value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">Sin asignar</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </Field>
          <Field label="Cliente (opcional)">
            <select className={INPUT} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">Sin cliente</option>
              {sortedClients.map(c => <option key={c.id} value={c.id}>{c.full_name ?? c.phone ?? 'Sin nombre'}</option>)}
            </select>
          </Field>
          <Field label="Fecha límite">
            <input className={INPUT} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </Field>
          <Field label="Prioridad">
            <div className="flex gap-1.5 pt-1">
              {Object.entries(TASK_PRIORITY).map(([v, m]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: v }))}
                  className={[
                    'px-3 py-1.5 text-xs font-sans font-medium rounded-pill transition-colors',
                    form.priority === v ? 'bg-brand-teal text-white' : 'bg-brand-light-gray/60 text-brand-charcoal/60 hover:bg-brand-light-gray',
                  ].join(' ')}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </OpsModal>
    </div>
  )
}
