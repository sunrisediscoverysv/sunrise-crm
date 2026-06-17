import { useState } from 'react'
import { useClients, type ClientFilters } from '@/hooks/useClients'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useProfiles } from '@/hooks/useProfiles'
import { ClientFiltersBar } from './ClientFilters'
import { ClientsTable } from './ClientsTable'

export function ClientsPage() {
  const [filters, setFilters] = useState<ClientFilters>({})
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
      </div>

      <div className="mb-4">
        <ClientFiltersBar
          filters={filters}
          onChange={setFilters}
          stages={stages}
          agents={agents}
        />
      </div>

      <ClientsTable clients={clients} loading={isLoading} />
    </div>
    </div>
  )
}
