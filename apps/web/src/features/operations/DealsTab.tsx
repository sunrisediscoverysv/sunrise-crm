import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDeals } from '@/hooks/useOperations'
import { useClients } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { useProperties } from '@/hooks/useProperties'
import { createDeal, updateDeal, deleteDeal } from '@/lib/mutations'
import { money, DEAL_STATUS } from './operationsMeta'
import { OpsModal, Field, MoneyInput, parseAmount, AddButton, RowDelete, ClientPicker, LoadError, INPUT } from './OpsUI'

const EMPTY_FORM = {
  title: '', client_id: '', property_id: '', agent_id: '',
  amount: '', commission: '', status: 'closed', closed_at: new Date().toISOString().slice(0, 10),
}

export function DealsTab() {
  const queryClient = useQueryClient()
  const { data: deals = [], isLoading, error: loadError } = useDeals()
  const { data: clients = [] } = useClients()
  const { data: agents = [] } = useProfiles()
  const { data: properties = [] } = useProperties()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')),
    [clients],
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deals'] })

  const createMut = useMutation({
    mutationFn: () => createDeal({
      title: form.title.trim(),
      client_id: form.client_id || null,
      property_id: form.property_id || null,
      agent_id: form.agent_id || null,
      amount_usd: parseAmount(form.amount) ?? 0,
      commission_usd: parseAmount(form.commission),
      status: form.status as 'closed' | 'pending' | 'cancelled',
      closed_at: form.closed_at,
    }),
    onSuccess: () => { invalidate(); setOpen(false); setForm(EMPTY_FORM); setError(null) },
    onError: (e: Error) => setError(e.message),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateDeal(id, { status: status as never }),
    onSuccess: invalidate,
    onError: (e: Error) => alert(`No se pudo actualizar: ${e.message}`),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => { invalidate(); setConfirmId(null) },
    onError: (e: Error) => alert(`No se pudo eliminar: ${e.message}`),
  })

  function submit() {
    setError(null)
    if (!form.title.trim()) return setError('Ponle un título a la venta (ej. "Lote #12 El Zonte").')
    if (parseAmount(form.amount) == null) return setError('Indica el monto de la venta.')
    createMut.mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-sans text-brand-charcoal/50">
          {deals.length} venta{deals.length !== 1 ? 's' : ''} registrada{deals.length !== 1 ? 's' : ''}
        </p>
        <AddButton label="Registrar venta" onClick={() => { setForm(EMPTY_FORM); setError(null); setOpen(true) }} />
      </div>

      <LoadError error={loadError} />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-brand-light-gray rounded-card animate-pulse" />)}
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-white rounded-card shadow-card py-12 text-center">
          <p className="text-sm text-brand-charcoal/45 font-sans">Aún no hay ventas. Registra la primera con el botón de arriba.</p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-light-gray">
                {['Venta', 'Agente', 'Monto', 'Comisión', 'Cierre', 'Estado', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-light-gray/70">
              {deals.map(d => {
                const s = DEAL_STATUS[d.status]
                return (
                  <tr key={d.id} className="hover:bg-brand-light-gray/20 transition-colors">
                    <td className="px-4 py-3 min-w-[200px]">
                      <p className="text-sm font-semibold text-brand-dark font-sans">{d.title}</p>
                      <p className="text-xs text-brand-charcoal/50 font-sans mt-0.5">
                        {d.client ? (
                          <Link to={`/clients/${d.client_id}`} className="hover:text-brand-teal transition-colors">
                            {d.client.full_name ?? 'Cliente'}
                          </Link>
                        ) : '—'}
                        {d.property?.name && <span> · {d.property.name}</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-charcoal/70 font-sans whitespace-nowrap">{d.agent?.full_name?.split(' ')[0] ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-teal font-sans whitespace-nowrap tabular-nums">{money(d.amount_usd)}</td>
                    <td className="px-4 py-3 text-sm text-brand-charcoal/70 font-sans whitespace-nowrap tabular-nums">{d.commission_usd != null ? money(d.commission_usd) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-brand-charcoal/60 font-sans whitespace-nowrap">{format(new Date(d.closed_at + 'T00:00:00'), 'd MMM yyyy', { locale: es })}</td>
                    <td className="px-4 py-3">
                      <select
                        value={d.status}
                        onChange={e => statusMut.mutate({ id: d.id, status: e.target.value })}
                        className={`text-xs font-sans font-medium px-2 py-1 rounded-pill border-0 cursor-pointer ${s.bg}`}
                      >
                        {Object.entries(DEAL_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <RowDelete
                        confirming={confirmId === d.id}
                        onAsk={() => setConfirmId(d.id)}
                        onConfirm={() => delMut.mutate(d.id)}
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

      <OpsModal open={open} title="Registrar venta" onClose={() => setOpen(false)} onSubmit={submit} saving={createMut.isPending} error={error}>
        <Field label="Título">
          <input className={INPUT} autoFocus placeholder='Ej. "Lote #12 — El Zonte"' value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Cliente">
          <ClientPicker clients={sortedClients} value={form.client_id} onChange={id => setForm(f => ({ ...f, client_id: id }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Propiedad">
            <select className={INPUT} value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
              <option value="">Sin propiedad</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Agente">
            <select className={INPUT} value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}>
              <option value="">Sin asignar</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </Field>
          <Field label="Monto (USD)">
            <MoneyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} />
          </Field>
          <Field label="Comisión (USD)">
            <MoneyInput value={form.commission} onChange={v => setForm(f => ({ ...f, commission: v }))} />
          </Field>
          <Field label="Fecha de cierre" className="col-span-2">
            <input className={INPUT} type="date" value={form.closed_at} onChange={e => setForm(f => ({ ...f, closed_at: e.target.value }))} />
          </Field>
        </div>
        <Field label="Estado">
          <div className="flex gap-1.5">
            {Object.entries(DEAL_STATUS).map(([v, m]) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm(f => ({ ...f, status: v }))}
                className={[
                  'px-3 py-1.5 text-xs font-sans font-medium rounded-pill transition-colors',
                  form.status === v ? 'bg-brand-teal text-white' : 'bg-brand-light-gray/60 text-brand-charcoal/60 hover:bg-brand-light-gray',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
      </OpsModal>
    </div>
  )
}
