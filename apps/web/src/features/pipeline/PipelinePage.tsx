import { useState, useEffect } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useQueryClient } from '@tanstack/react-query'
import { KanbanColumn } from './KanbanColumn'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useClients, type ClientWithProfile } from '@/hooks/useClients'
import { moveClientToStage } from '@/lib/mutations'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/features/auth/AuthContext'

export function PipelinePage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: stages = [], isLoading: loadingStages } = usePipelineStages()
  const { data: clients = [], isLoading: loadingClients } = useClients()
  const [movingId, setMovingId] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel('pipeline-clients-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const clientsByStage: Record<string, ClientWithProfile[]> = {}
  for (const stage of stages) clientsByStage[stage.id] = []
  for (const client of clients) {
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
          ? {
              ...c,
              stage_id: toStageId,
              pipeline_stages: toStage
                ? { name: toStage.name, color: toStage.color }
                : c.pipeline_stages,
            }
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-8 pt-5 md:pt-8 pb-4 md:pb-5 bg-[#f7f8f9] border-b border-brand-light-gray flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-brand-dark">Pipeline</h1>
            <p className="text-brand-charcoal/60 font-sans mt-0.5 text-sm">
              {clients.length} cliente{clients.length !== 1 ? 's' : ''} en el embudo
            </p>
          </div>
          {movingId && (
            <div className="flex items-center gap-2 text-sm text-brand-charcoal/60 font-sans">
              <span className="h-4 w-4 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
              <span className="hidden sm:inline">Guardando...</span>
            </div>
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
            <div className="flex gap-3 md:gap-4 p-4 md:p-6 min-w-max min-h-full items-start">
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
    </div>
  )
}
