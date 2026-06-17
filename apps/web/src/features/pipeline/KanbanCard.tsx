import { Draggable } from '@hello-pangea/dnd'
import { Link } from 'react-router-dom'
import { ChannelBadge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import type { ClientWithProfile } from '@/hooks/useClients'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface KanbanCardProps {
  client: ClientWithProfile
  index: number
}

const interestLabel: Record<string, string> = {
  real_estate: 'Real Estate',
  construction: 'Construcción',
  concierge: 'Concierge',
  other: 'Otro',
}

export function KanbanCard({ client, index }: KanbanCardProps) {
  const assignee = client.profiles as { full_name: string; avatar_url: string | null } | null
  const ago = formatDistanceToNow(new Date(client.last_contact_at ?? client.created_at), {
    addSuffix: true,
    locale: es,
  })

  const followUp = client.follow_up_at ? new Date(client.follow_up_at) : null
  const now = new Date()
  const followUpOverdue = followUp && followUp < now
  const followUpToday = followUp && followUp.toDateString() === now.toDateString()

  return (
    <Draggable draggableId={client.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={[
            'bg-white rounded-card border p-3.5 cursor-grab active:cursor-grabbing select-none',
            'transition-all duration-150',
            snapshot.isDragging
              ? 'shadow-xl border-brand-teal/50 rotate-1 scale-[1.02]'
              : 'border-brand-light-gray hover:border-brand-teal/40 hover:shadow-md',
          ].join(' ')}
        >
          {/* Name + channel */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <Link
              to={`/clients/${client.id}`}
              className="text-sm font-semibold text-brand-dark font-sans leading-snug hover:text-brand-teal transition-colors line-clamp-2 flex-1"
              onClick={e => e.stopPropagation()}
            >
              {client.full_name ?? 'Sin nombre'}
            </Link>
            <ChannelBadge channel={client.channel} />
          </div>

          {/* Phone */}
          {client.phone && (
            <p className="text-xs text-brand-charcoal/50 font-sans mb-1.5 truncate flex items-center gap-1">
              <span className="opacity-60">📞</span> {client.phone}
            </p>
          )}

          {/* Interest */}
          {client.interest_type && (
            <p className="text-xs text-brand-teal/80 font-sans mb-2.5 font-medium">
              {interestLabel[client.interest_type]}
              {client.property_of_interest && (
                <span className="text-brand-charcoal/50 font-normal"> · {client.property_of_interest}</span>
              )}
            </p>
          )}

          {/* Follow-up badge */}
          {followUp && (
            <div className={[
              'flex items-center gap-1 text-xs font-sans px-2 py-0.5 rounded-pill w-fit mb-2',
              followUpOverdue ? 'bg-red-50 text-red-500' : followUpToday ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-500',
            ].join(' ')}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {followUpOverdue ? 'Vencido · ' : followUpToday ? 'Hoy · ' : ''}
              {followUp.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' })}
            </div>
          )}

          {/* Footer: assignee + time */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-brand-light-gray/80">
            {assignee ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <Avatar name={assignee.full_name} src={assignee.avatar_url} size="sm" />
                <span className="text-xs text-brand-charcoal/50 font-sans truncate max-w-[80px]">
                  {assignee.full_name.split(' ')[0]}
                </span>
              </div>
            ) : (
              <span className="text-xs text-brand-charcoal/30 font-sans">Sin asignar</span>
            )}
            <span className="text-xs text-brand-charcoal/35 font-sans flex-shrink-0">{ago}</span>
          </div>
        </div>
      )}
    </Draggable>
  )
}
