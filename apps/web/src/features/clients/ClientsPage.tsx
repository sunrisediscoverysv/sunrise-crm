import { useState } from 'react'
import { useClientsPaginated, fetchClientsForExport, type ClientFilters, type ClientWithProfile } from '@/hooks/useClients'
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

const PAGE_SIZE = 25

export function ClientsPage() {
  const [filters, setFilters] = useState<ClientFilters>({})
  const [page, setPage] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { data, isLoading, isFetching } = useClientsPaginated(filters, page, PAGE_SIZE)
  const { data: stages = [] } = usePipelineStages()
  const { data: agents = [] } = useProfiles()

  const clients = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Cualquier cambio de filtro vuelve a la primera página.
  function handleFilters(next: ClientFilters) {
    setFilters(next)
    setPage(0)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const all = await fetchClientsForExport(filters)
      exportToCSV(all)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Clientes</h1>
            <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">
              {total} resultado{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={total === 0 || exporting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-sans text-brand-charcoal/70 border border-brand-light-gray rounded-button bg-white hover:bg-brand-light-gray/50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">{exporting ? 'Exportando…' : 'Exportar CSV'}</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep hover:-translate-y-px active:translate-y-0 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nuevo lead
            </button>
          </div>
        </div>

        <div className="mb-4">
          <ClientFiltersBar filters={filters} onChange={handleFilters} stages={stages} agents={agents} />
        </div>

        <ClientsTable clients={clients} loading={isLoading} />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
            <p className="text-xs font-sans text-brand-charcoal/50 tabular-nums">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="px-3 py-1.5 text-sm font-sans text-brand-charcoal/70 border border-brand-light-gray rounded-button bg-white hover:bg-brand-light-gray/50 transition-colors disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-sm font-sans text-brand-charcoal/60 tabular-nums px-1">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
                className="px-3 py-1.5 text-sm font-sans text-brand-charcoal/70 border border-brand-light-gray rounded-button bg-white hover:bg-brand-light-gray/50 transition-colors disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      <NewClientModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
