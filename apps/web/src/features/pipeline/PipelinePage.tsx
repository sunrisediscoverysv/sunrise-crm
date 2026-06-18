import { useState, useEffect, useMemo } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useQueryClient } from '@tanstack/react-query'
import { KanbanColumn } from './KanbanColumn'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useClients, type ClientWithProfile } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { moveClientToStage } from '@/lib/mutations'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/features/auth/AuthContext'
import { NewClientModal } from '@/features/clients/NewClientModal'

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
}

export function PipelinePage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: stages = [], isLoading: loadingStages } = usePipelineStages()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const { data: agents = [] } = useProfiles()
  const [movingId, setMovingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filterChannel, setFilterChannel] = useState('')
  const [filterAgent, setFilterAgent] = useState('')

  useEffect(() => {
    const channel = supabase
      .channel('pipeline-clients-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (filterChannel && c.channel !== filterChannel) return false
      if (filterAgent && c.assigned_to !== filterAgent) return false
      return true
    })
  }, [clients, filterChannel, filterAgent])

  const clientsByStage: Record<string, ClientWithProfile[]> = {}
  for (const stage of stages) clientsByStage[stage.id] = []
  for (const client of filteredClients) {
    if (client.stage_id && clientsByStage[client.stage_id]) {
      clientsByStage[client.stage_id].push(client)
    }
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const clientId = draggableId
    const fromStageId = source.droppableId
    const toStageId = destination.droppableId

    queryClient.setQueryData<ClientWithProfile[]>(['clients', {}], old => {
      if (!old) return old
      const toStage = stages.find(s => s.id === toStageId)
      return old.map(c =>
        c.id === clientId
          ? { ...c, stage_id: toStageId, pipeline_stages: toStage ? { name: toStage.name, color: toStage.color } : c.pipeline_stages }
          : c,
      )
    })

    setMovingId(clientId)
    try {
      await moveClientToStage(clientId, toStageId, fromStageId, user?.id ?? null)
    } finally {
      setMovingId(null)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    }
  }

  const isLoading = loadingStages || loadingClients
  const activeFilters = [filterChannel, filterAgent].filter(Boolean).length

  return (
    <div className="flex flex-col h-full bg-[#f6f8f9] bg-app">
      {/* Header */}
      <div className="px-4 md:px-8 pt-5 md:pt-6 pb-3 bg-white/70 backdrop-blur-sm border-b border-brand-light-gray flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Pipeline</h1>
            <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">
              {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
              {activeFilters > 0 && <span className="text-brand-teal"> · {activeFilters} filtro{activeFilters > 1 ? 's' : ''} activo{activeFilters > 1 ? 's' : ''}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {movingId && (
              <div className="flex items-center gap-2 text-sm text-brand-charcoal/60 font-sans">
                <span className="h-4 w-4 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep hover:-translate-y-px active:translate-y-0 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nuevo lead</span>
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-brand-charcoal/40 font-sans">Filtrar:</span>

          {/* Channel filter */}
          <div className="flex gap-1 flex-wrap">
            {Object.entries(CHANNEL_LABELS).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterChannel(f => f === val ? '' : val)}
                className={[
                  'text-xs px-2.5 py-1 rounded-pill font-sans transition-colors',
                  filterChannel === val
                    ? 'bg-brand-teal text-white'
                    : 'bg-white border border-brand-light-gray text-brand-charcoal/60 hover:border-brand-teal/40',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Agent filter */}
          {agents.length > 0 && (
            <select
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-pill border border-brand-light-gray font-sans text-brand-charcoal/60 bg-white focus:outline-none focus:border-brand-teal/40"
            >
              <option value="">Todos los agentes</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}

          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterChannel(''); setFilterAgent('') }}
              className="text-xs px-2.5 py-1 rounded-pill text-brand-charcoal/50 hover:text-red-500 font-sans transition-colors"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="h-8 w-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <div
              className="grid gap-3 p-4 md:gap-4 md:p-6 min-h-full auto-rows-fr"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {stages.map(stage => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  clients={clientsByStage[stage.id] ?? []}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      <NewClientModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
