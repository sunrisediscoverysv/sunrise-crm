import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import type { ClientFilters } from '@/hooks/useClients'
import type { PipelineStage, Profile } from '@/types/database'

interface ClientFiltersProps {
  filters: ClientFilters
  onChange: (filters: ClientFilters) => void
  stages: PipelineStage[]
  agents: Profile[]
}

const channelOptions = [
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'web_chat',  label: 'Web Chat' },
  { value: 'other',     label: 'Otro' },
]

const registeredOptions = [
  { value: 'yes', label: 'Registrados' },
  { value: 'no',  label: 'No registrados' },
]

export function ClientFiltersBar({ filters, onChange, stages, agents }: ClientFiltersProps) {
  function set<K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) {
    onChange({ ...filters, [key]: value || undefined })
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search */}
      <div className="min-w-[220px] flex-1">
        <Input
          placeholder="Buscar por nombre, teléfono o email…"
          value={filters.search ?? ''}
          onChange={e => set('search', e.target.value)}
          className="h-9"
        />
      </div>

      {/* Channel */}
      <div className="w-36">
        <Select
          placeholder="Canal"
          options={channelOptions}
          value={filters.channel ?? ''}
          onChange={e => set('channel', e.target.value)}
          className="h-9"
        />
      </div>

      {/* Stage */}
      <div className="w-44">
        <Select
          placeholder="Etapa"
          options={stages.map(s => ({ value: s.id, label: s.name }))}
          value={filters.stageId ?? ''}
          onChange={e => set('stageId', e.target.value)}
          className="h-9"
        />
      </div>

      {/* Agent */}
      <div className="w-40">
        <Select
          placeholder="Agente"
          options={agents.map(a => ({ value: a.id, label: a.full_name }))}
          value={filters.assignedTo ?? ''}
          onChange={e => set('assignedTo', e.target.value)}
          className="h-9"
        />
      </div>

      {/* Registered */}
      <div className="w-40">
        <Select
          placeholder="Registro"
          options={registeredOptions}
          value={filters.registered ?? ''}
          onChange={e => set('registered', e.target.value as ClientFilters['registered'])}
          className="h-9"
        />
      </div>

      {/* Clear */}
      {Object.values(filters).some(Boolean) && (
        <button
          onClick={() => onChange({})}
          className="text-sm text-brand-charcoal/50 font-sans hover:text-brand-charcoal transition-colors whitespace-nowrap"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
