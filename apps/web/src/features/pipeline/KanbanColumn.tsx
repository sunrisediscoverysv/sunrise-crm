import { Droppable } from '@hello-pangea/dnd'
import { KanbanCard } from './KanbanCard'
import type { PipelineStage } from '@/types/database'
import type { ClientWithProfile } from '@/hooks/useClients'

interface KanbanColumnProps {
  stage: PipelineStage
  clients: ClientWithProfile[]
  /** Columna a todo el ancho con tarjetas en cuadrícula (para el bin de Congelados). */
  wide?: boolean
}

export function KanbanColumn({ stage, clients, wide = false }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-full md:h-full">
      {/* Column header — solid Monday-style group bar */}
      <div
        className="flex items-center gap-2.5 mb-2.5 px-3.5 py-2.5 rounded-xl shadow-sm"
        style={{ backgroundColor: stage.color }}
      >
        <h3 className="text-xs font-bold text-white font-sans flex-1 truncate uppercase tracking-wider drop-shadow-sm">
          {stage.name}
        </h3>
        <span className="text-xs font-bold font-sans px-2 py-0.5 rounded-pill bg-white/25 text-white min-w-[22px] text-center backdrop-blur-sm">
          {clients.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.id} direction={wide ? 'horizontal' : 'vertical'}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={[
              'rounded-b-card p-2.5 min-h-[56px] md:min-h-[80px] transition-colors duration-150',
              wide
                ? 'grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]'
                : 'flex flex-col gap-2.5 flex-1',
              snapshot.isDraggingOver
                ? 'bg-brand-teal/5 ring-1 ring-brand-teal/30'
                : 'bg-[#ededef]',
            ].join(' ')}
          >
            {clients.length === 0 && !snapshot.isDraggingOver && (
              <div className={[
                'flex items-center justify-center h-16 text-xs text-brand-charcoal/35 font-sans italic select-none',
                wide ? 'col-span-full' : '',
              ].join(' ')}>
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
