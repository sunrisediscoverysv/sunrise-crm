import { useState } from 'react'
import { useClients, type ClientFilters, type ClientWithProfile } from '@/hooks/useClients'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useProfiles } from '@/hooks/useProfiles'
import { ClientFiltersBar } from './ClientFilters'
import { ClientsTable } from './ClientsTable'
import { NewClientModal } from './NewClientModal'

function exportToCSV(clients: ClientWithProfile[]) {
  const headers = ['Nombre', 'Teléfono', 'Email', 'Canal', 'Etapa', 'Agente', 'Presupuesto', 'Interés', 'Fuente', 'Creado']
  const interestLabel: Record<string, string> = {
    real_estate: 'Real Estate', construction: 'Construcción', concierge: 'Concierge', other: 'Otro',
  }
  const channelLabel: Record<string, string> = {
    whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', web_chat: 'Web Chat', other: 'Otro',
  }
  const rows = clients.map(c => {
    const stage = c.pipeline_stages as { name: string } | null
    const agent = c.profiles as { full_name: string } | null
    return [
      c.full_name ?? '',
      c.phone ?? '',
      c.email ?? '',
      channelLabel[c.channel] ?? c.channel,
      stage?.name ?? '',
      agent?.full_name ?? '',
      c.budget_range ?? '',
      c.interest_type ? (interestLabel[c.interest_type] ?? c.interest_type) : '',
      c.source ?? '',
      new Date(c.created_at).toLocaleDateString('es-SV'),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`)
  })

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clientes-sunrise-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ClientsPage() {
  const [filters, setFilters] = useState<ClientFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const { data: clients = [], isLoading } = useClients(filters)
  const { data: stages = [] } = usePipelineStages()
  const { data: agents = [] } = useProfiles()

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-brand-dark">Clientes</h1>
            <p className="text-brand-charcoal/60 font-sans mt-0.5 text-sm">
              {clients.length} resultado{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(clients)}
              disabled={clients.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-sans text-brand-charcoal/70 border border-brand-light-gray rounded-button bg-white hover:bg-brand-light-gray/50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button hover:bg-brand-deep transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nuevo lead
            </button>
          </div>
        </div>

        <div className="mb-4">
          <ClientFiltersBar filters={filters} onChange={setFilters} stages={stages} agents={agents} />
        </div>

        <ClientsTable clients={clients} loading={isLoading} />
      </div>

      <NewClientModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
