import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Link } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChannelBadge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import type { PipelineStage } from '@/types/database'
import type { ClientWithProfile } from '@/hooks/useClients'
import type { StandbyDetail } from './useStandbyDetails'

interface StandbyListProps {
  stage: PipelineStage
  clients: ClientWithProfile[]
  details: Record<string, StandbyDetail>
}

const EMPTY: StandbyDetail = { firstAt: null, lastAt: null, lastDirection: null, comment: null }

function fmtDate(iso: string | null): string {
  return iso ? format(new Date(iso), "d MMM yyyy", { locale: es }) : '—'
}

export function StandbyList({ stage, clients, details }: StandbyListProps) {
  // Ordenar por última interacción (más reciente primero).
  const sorted = [...clients].sort((a, b) => {
    const la = details[a.id]?.lastAt ?? a.last_contact_at ?? a.created_at
    const lb = details[b.id]?.lastAt ?? b.last_contact_at ?? b.created_at
    return new Date(lb).getTime() - new Date(la).getTime()
  })

  return (
    <Droppable droppableId={stage.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={[
            'rounded-b-card divide-y divide-brand-light-gray/70 border border-brand-light-gray rounded-xl overflow-hidden transition-colors',
            snapshot.isDraggingOver ? 'bg-brand-teal/5 ring-1 ring-brand-teal/30' : 'bg-white',
          ].join(' ')}
        >
          {sorted.length === 0 && !snapshot.isDraggingOver && (
            <div className="flex items-center justify-center h-16 text-xs text-brand-charcoal/35 font-sans italic select-none">
              Arrastra aquí los leads sin movimiento
            </div>
          )}

          {sorted.map((client, index) => {
            const d = details[client.id] ?? EMPTY
            const assignee = client.profiles as { full_name: string; avatar_url: string | null } | null

            // Quién quedó sin contestar.
            const owedByUs = d.lastDirection === 'inbound'   // el cliente escribió último
            const owedByThem = d.lastDirection === 'outbound' // nosotros escribimos último
            const statusLabel = owedByUs ? 'Falta responderles'
              : owedByThem ? 'Sin respuesta del cliente' : 'Sin mensajes'
            const statusClass = owedByUs ? 'bg-amber-50 text-amber-700'
              : owedByThem ? 'bg-slate-100 text-slate-600' : 'bg-gray-100 text-brand-charcoal/50'

            const lastAgo = d.lastAt ? formatDistanceToNow(new Date(d.lastAt), { addSuffix: true, locale: es }) : ''
            const lastWho = owedByThem ? 'por ti' : owedByUs ? 'por el cliente' : ''

            return (
              <Draggable key={client.id} draggableId={client.id} index={index}>
                {(dp, snap) => (
                  <div
                    ref={dp.innerRef}
                    {...dp.draggableProps}
                    {...dp.dragHandleProps}
                    className={[
                      'px-4 py-3 select-none cursor-grab active:cursor-grabbing transition-colors',
                      snap.isDragging ? 'bg-white shadow-card-hover ring-1 ring-brand-teal/40 rounded-xl' : 'hover:bg-brand-light-gray/30',
                    ].join(' ')}
                  >
                    {/* Fila 1: nombre + canal + estado + última interacción */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/clients/${client.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-sm font-semibold text-brand-dark font-sans hover:text-brand-teal transition-colors truncate max-w-[220px]"
                      >
                        {client.full_name ?? client.phone ?? 'Sin nombre'}
                      </Link>
                      <ChannelBadge channel={client.channel} />
                      <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded-pill ${statusClass}`}>
                        {statusLabel}
                      </span>
                      <span className="ml-auto text-[11px] text-brand-charcoal/40 font-sans" title={d.lastAt ? new Date(d.lastAt).toLocaleString('es-SV') : ''}>
                        {lastAgo}
                      </span>
                    </div>

                    {/* Fila 2: comentario (lo principal) */}
                    <p className={`text-sm font-sans mt-1.5 line-clamp-2 ${d.comment ? 'text-brand-charcoal/80' : 'text-brand-charcoal/35 italic'}`}>
                      {d.comment ? `“${d.comment}”` : 'Sin comentarios'}
                    </p>

                    {/* Fila 3: fechas + agente */}
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 text-[11px] text-brand-charcoal/50 font-sans">
                      <span>Inicio: <span className="text-brand-charcoal/70">{fmtDate(d.firstAt)}</span></span>
                      <span>Última respuesta: <span className="text-brand-charcoal/70">{fmtDate(d.lastAt)}{lastWho ? ` · ${lastWho}` : ''}</span></span>
                      {assignee && (
                        <span className="flex items-center gap-1 ml-auto">
                          <Avatar name={assignee.full_name} src={assignee.avatar_url} size="sm" />
                          <span className="text-brand-charcoal/50">{assignee.full_name.split(' ')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Draggable>
            )
          })}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}
