import { useState } from 'react'
import { useDeals, useTasks, usePayments } from '@/hooks/useOperations'
import { DealsTab } from './DealsTab'
import { TasksTab } from './TasksTab'
import { PaymentsTab } from './PaymentsTab'
import { money } from './operationsMeta'

type Tab = 'deals' | 'tasks' | 'payments'

const TABS: { key: Tab; label: string }[] = [
  { key: 'deals', label: 'Ventas' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'payments', label: 'Pagos' },
]

export function OperationsPage() {
  const [tab, setTab] = useState<Tab>('deals')
  const { data: deals = [] } = useDeals()
  const { data: tasks = [] } = useTasks()
  const { data: payments = [] } = usePayments()

  const soldValue = deals.filter(d => d.status === 'closed').reduce((s, d) => s + (d.amount_usd ?? 0), 0)
  const commissions = deals.filter(d => d.status === 'closed').reduce((s, d) => s + (d.commission_usd ?? 0), 0)
  const openTasks = tasks.filter(t => t.status !== 'done').length
  const duePayments = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + (p.amount_usd ?? 0), 0)

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Operaciones</h1>
          <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">Ventas cerradas, tareas del equipo y pagos.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <div className="bg-brand-teal shadow-stat-teal rounded-card p-5 relative overflow-hidden">
            <p className="text-white/80 text-[11px] font-sans font-bold uppercase tracking-wider">Ventas cerradas</p>
            <p className="font-display text-3xl text-white leading-none tabular-nums mt-3">{money(soldValue)}</p>
          </div>
          <div className="bg-brand-gold shadow-stat-gold rounded-card p-5 relative overflow-hidden">
            <p className="text-brand-dark/70 text-[11px] font-sans font-bold uppercase tracking-wider">Comisiones</p>
            <p className="font-display text-3xl text-brand-dark leading-none tabular-nums mt-3">{money(commissions)}</p>
          </div>
          <div className="bg-brand-deep shadow-card rounded-card p-5 relative overflow-hidden">
            <p className="text-white/70 text-[11px] font-sans font-bold uppercase tracking-wider">Tareas abiertas</p>
            <p className="font-display text-3xl text-white leading-none tabular-nums mt-3">{openTasks}</p>
          </div>
          <div className="bg-gradient-to-br from-brand-deep via-brand-dark to-[#0d3340] shadow-stat-dark rounded-card p-5 relative overflow-hidden">
            <p className="text-white/70 text-[11px] font-sans font-bold uppercase tracking-wider">Pagos pendientes</p>
            <p className="font-display text-3xl text-white leading-none tabular-nums mt-3">{money(duePayments)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-brand-light-gray/50 rounded-button p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'px-4 py-1.5 text-sm font-medium font-sans rounded-button transition-colors',
                tab === t.key ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-charcoal/60 hover:text-brand-dark',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'deals' && <DealsTab />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'payments' && <PaymentsTab />}
      </div>
    </div>
  )
}
