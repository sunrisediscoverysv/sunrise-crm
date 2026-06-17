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

  return (
    <Draggable draggableId={client.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={[
            'bg-white rounded-card border p-3.5 cursor-grab active:cursor-grabbing',
            'transition-shadow duration-150 group',
            snapshot.isDragging
              ? 'shadow-lg border-brand-teal/40 rotate-1'
              : 'border-brand-light-gray hover:border-brand-teal/30 hover:shadow-sm',
          ].join(' ')}
        >
          {/* Name + channel */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <Link
              to={`/clients/${client.id}`}
              className="text-sm font-medium text-brand-dark font-sans leading-snug hover:text-brand-teal transition-colors line-clamp-2"
              onClick={e => e.stopPropagation()}
            >
              {client.full_name ?? 'Sin nombre'}
            </Link>
            <ChannelBadge channel={client.channel} />
          </div>

          {/* Contact info */}
          {client.phone && (
            <p className="text-xs text-brand-charcoal/50 font-sans mb-1.5 truncate">{client.phone}</p>
          )}

          {/* Interest */}
          {client.interest_type && (
            <p className="text-xs text-brand-charcoal/60 font-sans mb-2.5 italic">
              {interestLabel[client.interest_type]}
              {client.property_of_interest && ` · ${client.property_of_interest}`}
            </p>
          )}

          {/* Footer: assignee + time */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-brand-light-gray">
            {assignee ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={assignee.full_name} src={assignee.avatar_url} size="sm" />
                <span className="text-xs text-brand-charcoal/50 font-sans truncate max-w-[80px]">
                  {assignee.full_name.split(' ')[0]}
                </span>
              </div>
            ) : (
              <span className="text-xs text-brand-charcoal/30 font-sans">Sin asignar</span>
            )}
            <span className="text-xs text-brand-charcoal/40 font-sans">{ago}</span>
          </div>
        </div>
      )}
    </Draggable>
  )
}
