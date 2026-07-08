import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isPast, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePayments, useDeals } from '@/hooks/useOperations'
import { useClients } from '@/hooks/useClients'
import { createPayment, updatePayment, deletePayment } from '@/lib/mutations'
import { money, PAYMENT_STATUS } from './operationsMeta'
import { OpsModal, Field, MoneyInput, parseAmount, AddButton, RowDelete, ClientPicker, LoadError, INPUT } from './OpsUI'

const EMPTY_FORM = { deal_id: '', client_id: '', amount: '', due_date: '', note: '' }

export function PaymentsTab() {
  const queryClient = useQueryClient()
  const { data: payments = [], isLoading, error: loadError } = usePayments()
  const { data: deals = [] } = useDeals()
  const { data: clients = [] } = useClients()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')),
    [clients],
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payments'] })

  const createMut = useMutation({
    mutationFn: () => createPayment({
      deal_id: form.deal_id || null,
      client_id: form.client_id || null,
      amount_usd: parseAmount(form.amount) ?? 0,
      due_date: form.due_date || null,
      note: form.note.trim() || null,
      status: 'pending',
    }),
    onSuccess: () => { invalidate(); setOpen(false); setForm(EMPTY_FORM); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  // Marcar pagado sella la fecha; revertir la limpia.
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updatePayment(id, { status: status as never, paid_at: status === 'paid' ? new Date().toISOString().slice(0, 10) : null }),
    onSuccess: invalidate,
    onError: (e: Error) => alert(`No se pudo actualizar: ${e.message}`),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => { invalidate(); setConfirmId(null) },
    onError: (e: Error) => alert(`No se pudo eliminar: ${e.message}`),
  })

  function submit() {
    setError(null)
    if (parseAmount(form.amount) == null) return setError('Indica el monto del pago.')
    if (!form.deal_id && !form.client_id) return setError('Asócialo a una venta o a un cliente.')
    createMut.mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-sans text-brand-charcoal/50">
          {payments.length} pago{payments.length !== 1 ? 's' : ''}
        </p>
        <AddButton label="Registrar pago" onClick={() => { setForm(EMPTY_FORM); setError(null); setOpen(true) }} />
      </div>

      <LoadError error={loadError} />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-brand-light-gray rounded-card animate-pulse" />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-card shadow-card py-12 text-center">
          <p className="text-sm text-brand-charcoal/45 font-sans">No hay pagos registrados. Registra una cuota o abono con el botón de arriba.</p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-light-gray">
                {['Concepto', 'Cliente', 'Monto', 'Vence', 'Pagado', 'Estado', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-light-gray/70">
              {payments.map(p => {
                const due = p.due_date ? new Date(p.due_date + 'T00:00:00') : null
                const overdue = due && p.status !== 'paid' && isPast(due) && !isToday(due)
                return (
                  <tr key={p.id} className="hover:bg-brand-light-gray/20 transition-colors">
                    <td className="px-4 py-3 min-w-[160px]">
                      <p className="text-sm font-semibold text-brand-dark font-sans">{p.note || p.deal?.title || 'Pago'}</p>
                      {p.note && p.deal?.title && <p className="text-xs text-brand-charcoal/50 font-sans mt-0.5">{p.deal.title}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-charcoal/70 font-sans whitespace-nowrap">
                      {p.client ? (
                        <Link to={`/clients/${p.client_id}`} className="hover:text-brand-teal transition-colors">
                          {p.client.full_name ?? 'Cliente'}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-teal font-sans whitespace-nowrap tabular-nums">{money(p.amount_usd)}</td>
                    <td className={`px-4 py-3 text-sm font-sans whitespace-nowrap ${overdue ? 'text-red-500 font-medium' : 'text-brand-charcoal/60'}`}>
                      {due ? format(due, 'd MMM yyyy', { locale: es }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-charcoal/60 font-sans whitespace-nowrap">
                      {p.paid_at ? format(new Date(p.paid_at + 'T00:00:00'), 'd MMM yyyy', { locale: es }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={p.status}
                        onChange={e => statusMut.mutate({ id: p.id, status: e.target.value })}
                        className={`text-xs font-sans font-medium px-2 py-1 rounded-pill border-0 cursor-pointer ${PAYMENT_STATUS[p.status].bg}`}
                      >
                        {Object.entries(PAYMENT_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <RowDelete
                        confirming={confirmId === p.id}
                        onAsk={() => setConfirmId(p.id)}
                        onConfirm={() => delMut.mutate(p.id)}
                        onCancel={() => setConfirmId(null)}
                        busy={delMut.isPending}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={open} title="Registrar pago" onClose={() => setOpen(false)} onSubmit={submit} saving={createMut.isPending} error={error}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto (USD)">
            <MoneyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} autoFocus />
          </Field>
          <Field label="Vence">
            <input className={INPUT} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </Field>
        </div>
        <Field label="Venta asociada (opcional)">
          <select className={INPUT} value={form.deal_id} onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}>
            <option value="">Sin venta</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </Field>
        <Field label="Cliente">
          <ClientPicker clients={sortedClients} value={form.client_id} onChange={id => setForm(f => ({ ...f, client_id: id }))} />
        </Field>
        <Field label="Nota">
          <input className={INPUT} placeholder="Ej. Cuota 1 de 12, prima, abono…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </Field>
      </OpsModal>
    </div>
  )
}
