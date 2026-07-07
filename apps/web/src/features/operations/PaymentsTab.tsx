import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePayments, useDeals } from '@/hooks/useOperations'
import { useClients } from '@/hooks/useClients'
import { createPayment, updatePayment, deletePayment } from '@/lib/mutations'
import { Button } from '@/components/Button'
import { money, PAYMENT_STATUS } from './operationsMeta'
import type { PaymentInsert } from '@/types/database'

const inputCls = 'w-full px-3 py-2 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal bg-white'

function NewPaymentForm() {
  const queryClient = useQueryClient()
  const { data: deals = [] } = useDeals()
  const { data: clients = [] } = useClients()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PaymentInsert>({ amount_usd: 0, status: 'pending' })

  const mut = useMutation({
    mutationFn: () => createPayment(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      setForm({ amount_usd: 0, status: 'pending' })
      setOpen(false)
    },
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-2 px-4 py-3 rounded-card border-2 border-dashed border-brand-light-gray text-brand-charcoal/50 hover:border-brand-teal hover:text-brand-teal transition-colors font-sans text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Registrar pago / cuota
      </button>
    )
  }

  return (
    <div className="bg-white rounded-card border border-brand-teal/40 p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <select className={inputCls} value={form.deal_id ?? ''} onChange={e => setForm(f => ({ ...f, deal_id: e.target.value || null }))}>
          <option value="">Venta asociada (opcional)…</option>
          {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <select className={inputCls} value={form.client_id ?? ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value || null }))}>
          <option value="">Cliente…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name ?? c.phone ?? 'Sin nombre'}</option>)}
        </select>
        <label className="text-xs text-brand-charcoal/50 font-sans flex flex-col gap-1">Monto (USD)
          <input className={inputCls} type="number" min={0} value={form.amount_usd ?? 0} onChange={e => setForm(f => ({ ...f, amount_usd: Number(e.target.value) }))} />
        </label>
        <label className="text-xs text-brand-charcoal/50 font-sans flex flex-col gap-1">Vence
          <input className={inputCls} type="date" value={form.due_date ?? ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value || null }))} />
        </label>
        <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PaymentInsert['status'] }))}>
          {Object.entries(PAYMENT_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <input className={inputCls} placeholder="Nota (ej. Cuota 1/12)" value={form.note ?? ''} onChange={e => setForm(f => ({ ...f, note: e.target.value || null }))} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={mut.isPending} disabled={!form.amount_usd} onClick={() => mut.mutate()}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

export function PaymentsTab() {
  const queryClient = useQueryClient()
  const { data: payments = [], isLoading } = usePayments()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payments'] })
  // Al marcar pagado, sella la fecha; al revertir, la limpia.
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updatePayment(id, { status: status as never, paid_at: status === 'paid' ? new Date().toISOString().slice(0, 10) : null }),
    onSuccess: invalidate,
  })
  const delMut = useMutation({ mutationFn: (id: string) => deletePayment(id), onSuccess: invalidate })
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <NewPaymentForm />
      {isLoading ? (
        [...Array(3)].map((_, i) => <div key={i} className="h-16 bg-brand-light-gray rounded-card animate-pulse" />)
      ) : payments.length === 0 ? (
        <p className="text-sm text-brand-charcoal/50 font-sans py-8 text-center">No hay pagos registrados.</p>
      ) : payments.map(p => (
        <div key={p.id} className="bg-white rounded-card shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-dark font-sans">{p.note || p.deal?.title || 'Pago'}</p>
              <p className="text-xs text-brand-charcoal/55 font-sans mt-0.5 truncate">
                {[p.client?.full_name, p.deal?.title, p.due_date ? `Vence ${p.due_date}` : null, p.paid_at ? `Pagado ${p.paid_at}` : null].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <p className="font-display text-lg text-brand-teal leading-none flex-shrink-0">{money(p.amount_usd)}</p>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <select value={p.status} onChange={e => statusMut.mutate({ id: p.id, status: e.target.value })} className={`text-xs font-sans px-2 py-1 rounded-pill font-medium border-0 cursor-pointer ${PAYMENT_STATUS[p.status].bg}`}>
              {Object.entries(PAYMENT_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
            <div className="flex-1" />
            {confirmId === p.id ? (
              <>
                <button onClick={() => delMut.mutate(p.id)} className="text-xs font-sans text-white bg-red-500 rounded-button px-2.5 py-1 hover:bg-red-600">Eliminar</button>
                <button onClick={() => setConfirmId(null)} className="text-xs font-sans text-brand-charcoal/60 px-2 py-1">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setConfirmId(p.id)} className="text-xs font-sans text-brand-charcoal/40 hover:text-red-500 px-2 py-1">Eliminar</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
