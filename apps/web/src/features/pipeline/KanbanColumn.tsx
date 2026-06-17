import { Droppable } from '@hello-pangea/dnd'
import { KanbanCard } from './KanbanCard'
import { EmptyState } from '@/components/EmptyState'
import type { PipelineStage } from '@/types/database'
import type { ClientWithProfile } from '@/hooks/useClients'

interface KanbanColumnProps {
  stage: PipelineStage
  clients: ClientWithProfile[]
}

export function KanbanColumn({ stage, clients }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="text-sm font-medium text-brand-charcoal font-sans flex-1 truncate">
          {stage.name}
        </h3>
        <span className="text-xs text-brand-charcoal/40 font-sans bg-brand-light-gray px-2 py-0.5 rounded-pill font-medium">
          {clients.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              'flex flex-col gap-2.5 flex-1 rounded-card p-2 min-h-[120px] transition-colors duration-150',
              snapshot.isDraggingOver ? 'bg-brand-teal/5 ring-1 ring-brand-teal/20' : 'bg-[#f0f1f3]',
            ].join(' ')}
          >
            {clients.length === 0 && !snapshot.isDraggingOver && (
              <EmptyState
                title=""
                description="Arrastra un cliente aquí"
              />
            )}
            {clients.map((client, index) => (
              <KanbanCard key={client.id} client={client} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
