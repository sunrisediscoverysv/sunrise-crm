import { Droppable } from '@hello-pangea/dnd'
import { KanbanCard } from './KanbanCard'
import type { PipelineStage } from '@/types/database'
import type { ClientWithProfile } from '@/hooks/useClients'

interface KanbanColumnProps {
  stage: PipelineStage
  clients: ClientWithProfile[]
}

export function KanbanColumn({ stage, clients }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-full md:w-72 md:flex-shrink-0">
      {/* Column header */}
      <div
        className="flex items-center gap-2.5 mb-2.5 px-3 py-2.5 rounded-t-card"
        style={{ borderTop: `3px solid ${stage.color}`, backgroundColor: `${stage.color}12` }}
      >
        <h3 className="text-xs font-semibold text-brand-charcoal font-sans flex-1 truncate uppercase tracking-wider">
          {stage.name}
        </h3>
        <span
          className="text-xs font-bold font-sans px-2 py-0.5 rounded-pill text-white min-w-[22px] text-center"
          style={{ backgroundColor: stage.color }}
        >
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
              'flex flex-col gap-2.5 flex-1 rounded-b-card p-2.5 min-h-[100px] transition-colors duration-150',
              snapshot.isDraggingOver
                ? 'bg-brand-teal/5 ring-1 ring-brand-teal/30'
                : 'bg-[#ededef]',
            ].join(' ')}
          >
            {clients.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-16 text-xs text-brand-charcoal/35 font-sans italic select-none">
                Sin clientes
              </div>
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
