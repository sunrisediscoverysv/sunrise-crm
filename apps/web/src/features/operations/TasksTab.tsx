import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTasks } from '@/hooks/useOperations'
import { useClients } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { useAuth } from '@/features/auth/AuthContext'
import { createTask, updateTask, deleteTask } from '@/lib/mutations'
import { Button } from '@/components/Button'
import { TASK_STATUS, TASK_PRIORITY } from './operationsMeta'
import type { TaskInsert } from '@/types/database'

const inputCls = 'w-full px-3 py-2 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal bg-white'

function NewTaskForm() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: clients = [] } = useClients()
  const { data: agents = [] } = useProfiles()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<TaskInsert>({ title: '', priority: 'medium', status: 'pending' })

  const mut = useMutation({
    mutationFn: () => createTask({ ...form, title: form.title.trim(), created_by: user?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setForm({ title: '', priority: 'medium', status: 'pending' })
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-2 px-4 py-3 rounded-card border-2 border-dashed border-brand-light-gray text-brand-charcoal/50 hover:border-brand-teal hover:text-brand-teal transition-colors font-sans text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Nueva tarea
      </button>
    )
  }

  return (
    <div className="bg-white rounded-card border border-brand-teal/40 p-4 flex flex-col gap-3">
      <input className={inputCls} placeholder="¿Qué hay que hacer?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
      <textarea className={inputCls} placeholder="Detalles (opcional)" rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} />
      <div className="grid grid-cols-2 gap-3">
        <select className={inputCls} value={form.assigned_to ?? ''} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value || null }))}>
          <option value="">Asignar a…</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select className={inputCls} value={form.client_id ?? ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value || null }))}>
          <option value="">Cliente (opcional)…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name ?? c.phone ?? 'Sin nombre'}</option>)}
        </select>
        <select className={inputCls} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskInsert['priority'] }))}>
          {Object.entries(TASK_PRIORITY).map(([v, m]) => <option key={v} value={v}>Prioridad {m.label}</option>)}
        </select>
        <label className="text-xs text-brand-charcoal/50 font-sans flex flex-col gap-1">Fecha límite
          <input className={inputCls} type="date" value={form.due_date ?? ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value || null }))} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={mut.isPending} disabled={!form.title.trim()} onClick={() => mut.mutate()}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

export function TasksTab() {
  const queryClient = useQueryClient()
  const { data: tasks = [], isLoading } = useTasks()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  const statusMut = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateTask(id, { status: status as never }), onSuccess: invalidate })
  const delMut = useMutation({ mutationFn: (id: string) => deleteTask(id), onSuccess: invalidate })
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <NewTaskForm />
      {isLoading ? (
        [...Array(3)].map((_, i) => <div key={i} className="h-16 bg-brand-light-gray rounded-card animate-pulse" />)
      ) : tasks.length === 0 ? (
        <p className="text-sm text-brand-charcoal/50 font-sans py-8 text-center">No hay tareas pendientes.</p>
      ) : tasks.map(t => {
        const pr = TASK_PRIORITY[t.priority]
        const done = t.status === 'done'
        return (
          <div key={t.id} className="bg-white rounded-card shadow-card p-4 border-l-4" style={{ borderColor: pr.color }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-semibold font-sans ${done ? 'text-brand-charcoal/40 line-through' : 'text-brand-dark'}`}>{t.title}</p>
                {t.description && <p className="text-xs text-brand-charcoal/55 font-sans mt-0.5">{t.description}</p>}
                <p className="text-xs text-brand-charcoal/45 font-sans mt-1">
                  {[t.assignee?.full_name, t.client?.full_name, t.due_date ? `Vence ${t.due_date}` : null].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <span className={`text-[11px] font-sans px-2 py-0.5 rounded-pill font-medium flex-shrink-0 ${pr.bg}`}>{pr.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <select value={t.status} onChange={e => statusMut.mutate({ id: t.id, status: e.target.value })} className={`text-xs font-sans px-2 py-1 rounded-pill font-medium border-0 cursor-pointer ${TASK_STATUS[t.status].bg}`}>
                {Object.entries(TASK_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
              <div className="flex-1" />
              {confirmId === t.id ? (
                <>
                  <button onClick={() => delMut.mutate(t.id)} className="text-xs font-sans text-white bg-red-500 rounded-button px-2.5 py-1 hover:bg-red-600">Eliminar</button>
                  <button onClick={() => setConfirmId(null)} className="text-xs font-sans text-brand-charcoal/60 px-2 py-1">Cancelar</button>
                </>
              ) : (
                <button onClick={() => setConfirmId(t.id)} className="text-xs font-sans text-brand-charcoal/40 hover:text-red-500 px-2 py-1">Eliminar</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
