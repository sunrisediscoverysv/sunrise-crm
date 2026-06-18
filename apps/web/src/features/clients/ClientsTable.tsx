import { Link } from 'react-router-dom'
import { ChannelBadge, Badge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import type { ClientWithProfile } from '@/hooks/useClients'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClientsTableProps {
  clients: ClientWithProfile[]
  loading: boolean
}

export function ClientsTable({ clients, loading }: ClientsTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-brand-light-gray last:border-0">
            <div className="h-4 bg-brand-light-gray rounded animate-pulse flex-1" />
            <div className="h-4 bg-brand-light-gray rounded animate-pulse w-24" />
            <div className="h-4 bg-brand-light-gray rounded animate-pulse w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card">
        <EmptyState
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          title="Sin clientes"
          description="No hay resultados para los filtros aplicados."
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-light-gray bg-[#f7f8f9]">
            <th className="text-left px-6 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider">Cliente</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider">Canal</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider hidden md:table-cell">Etapa</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider hidden lg:table-cell">Agente</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-brand-charcoal/50 font-sans uppercase tracking-wider hidden xl:table-cell">Creado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-light-gray">
          {clients.map(client => {
            const stage = client.pipeline_stages as { name: string; color: string } | null
            const assignee = client.profiles as { full_name: string; avatar_url: string | null } | null

            return (
              <tr key={client.id} className="hover:bg-[#f7f8f9] transition-colors">
                <td className="px-6 py-3.5">
                  <div>
                    <p className="font-medium text-brand-dark font-sans">
                      {client.full_name ?? 'Sin nombre'}
                    </p>
                    {client.phone && (
                      <p className="text-xs text-brand-charcoal/50 font-sans mt-0.5">{client.phone}</p>
                    )}
                    {client.email && (
                      <p className="text-xs text-brand-charcoal/50 font-sans">{client.email}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <ChannelBadge channel={client.channel} />
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  {stage ? (
                    <Badge color={stage.color}>{stage.name}</Badge>
                  ) : (
                    <span className="text-xs text-brand-charcoal/30 font-sans">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={assignee.full_name} src={assignee.avatar_url} size="sm" />
                      <span className="text-sm text-brand-charcoal font-sans">{assignee.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-brand-charcoal/30 font-sans">Sin asignar</span>
                  )}
                </td>
                <td className="px-4 py-3.5 hidden xl:table-cell">
                  <span className="text-xs text-brand-charcoal/50 font-sans">
                    {format(new Date(client.created_at), 'dd MMM yyyy', { locale: es })}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Link
                    to={`/clients/${client.id}`}
                    className="text-xs text-brand-teal font-medium font-sans hover:text-brand-deep transition-colors"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
