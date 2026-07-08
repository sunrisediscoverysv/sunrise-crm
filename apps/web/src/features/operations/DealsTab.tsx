import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeals } from '@/hooks/useOperations'
import { useClients } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { useProperties } from '@/hooks/useProperties'
import { createDeal, updateDeal, deleteDeal } from '@/lib/mutations'
import { Button } from '@/components/Button'
import { money, DEAL_STATUS } from './operationsMeta'
import type { DealInsert } from '@/types/database'

const inputCls = 'w-full px-3 py-2 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal bg-white'

function NewDealForm() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data: clients = [] } = useClients()
  const { data: agents = [] } = useProfiles()
  const { data: properties = [] } = useProperties()
  const [form, setForm] = useState<DealInsert>({ title: '', amount_usd: 0, status: 'closed', closed_at: new Date().toISOString().slice(0, 10) })

  const mut = useMutation({
    mutationFn: () => createDeal({ ...form, title: form.title.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      setForm({ title: '', amount_usd: 0, status: 'closed', closed_at: new Date().toISOString().slice(0, 10) })
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-2 px-4 py-3 rounded-card border-2 border-dashed border-brand-light-gray text-brand-charcoal/50 hover:border-brand-teal hover:text-brand-teal transition-colors font-sans text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Registrar venta
      </button>
    )
  }

  return (
    <div className="bg-white rounded-card border border-brand-teal/40 p-4 flex flex-col gap-3">
      <input className={inputCls} placeholder="Título (ej. Venta terreno El Zonte)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <select className={inputCls} value={form.client_id ?? ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value || null }))}>
          <option value="">Cliente…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name ?? c.phone ?? 'Sin nombre'}</option>)}
        </select>
        <select className={inputCls} value={form.property_id ?? ''} onChange={e => setForm(f => ({ ...f, property_id: e.target.value || null }))}>
          <option value="">Propiedad…</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={inputCls} value={form.agent_id ?? ''} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value || null }))}>
          <option value="">Agente…</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DealInsert['status'] }))}>
          {Object.entries(DEAL_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <label className="text-xs text-brand-charcoal/50 font-sans flex flex-col gap-1">Monto (USD)
          <input className={inputCls} type="number" min={0} value={form.amount_usd ?? 0} onChange={e => setForm(f => ({ ...f, amount_usd: Number(e.target.value) }))} />
        </label>
        <label className="text-xs text-brand-charcoal/50 font-sans flex flex-col gap-1">Comisión (USD)
          <input className={inputCls} type="number" min={0} value={form.commission_usd ?? ''} onChange={e => setForm(f => ({ ...f, commission_usd: e.target.value ? Number(e.target.value) : null }))} />
        </label>
        <label className="text-xs text-brand-charcoal/50 font-sans flex flex-col gap-1 col-span-2">Fecha de cierre
          <input className={inputCls} type="date" value={form.closed_at ?? ''} onChange={e => setForm(f => ({ ...f, closed_at: e.target.value }))} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={mut.isPending} disabled={!form.title.trim()} onClick={() => mut.mutate()}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

export function DealsTab() {
  const queryClient = useQueryClient()
  const { data: deals = [], isLoading } = useDeals()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deals'] })
  const statusMut = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateDeal(id, { status: status as never }), onSuccess: invalidate })
  const delMut = useMutation({ mutationFn: (id: string) => deleteDeal(id), onSuccess: invalidate })
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <NewDealForm />
      {isLoading ? (
        [...Array(3)].map((_, i) => <div key={i} className="h-20 bg-brand-light-gray rounded-card animate-pulse" />)
      ) : deals.length === 0 ? (
        <p className="text-sm text-brand-charcoal/50 font-sans py-8 text-center">Aún no hay ventas registradas.</p>
      ) : deals.map(d => {
        const s = DEAL_STATUS[d.status]
        return (
          <div key={d.id} className="bg-white rounded-card shadow-card p-4 border-l-4" style={{ borderColor: s.color }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-dark font-sans">{d.title}</p>
                <p className="text-xs text-brand-charcoal/55 font-sans mt-0.5 truncate">
                  {[d.client?.full_name, d.property?.name, d.agent?.full_name].filter(Boolean).join(' · ') || '—'}
                </p>
                <p className="text-xs text-brand-charcoal/45 font-sans mt-0.5">Cierre: {d.closed_at}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-display text-xl text-brand-teal leading-none">{money(d.amount_usd)}</p>
                {d.commission_usd != null && <p className="text-[11px] text-brand-charcoal/50 font-sans mt-1">Comisión {money(d.commission_usd)}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <select value={d.status} onChange={e => statusMut.mutate({ id: d.id, status: e.target.value })} className={`text-xs font-sans px-2 py-1 rounded-pill font-medium border-0 cursor-pointer ${s.bg}`}>
                {Object.entries(DEAL_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
              <div className="flex-1" />
              {confirmId === d.id ? (
                <>
                  <button onClick={() => delMut.mutate(d.id)} className="text-xs font-sans text-white bg-red-500 rounded-button px-2.5 py-1 hover:bg-red-600">Eliminar</button>
                  <button onClick={() => setConfirmId(null)} className="text-xs font-sans text-brand-charcoal/60 px-2 py-1">Cancelar</button>
                </>
              ) : (
                <button onClick={() => setConfirmId(d.id)} className="text-xs font-sans text-brand-charcoal/40 hover:text-red-500 px-2 py-1">Eliminar</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
