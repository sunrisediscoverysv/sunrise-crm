import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/hooks/useClients'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useProfiles } from '@/hooks/useProfiles'
import { useAuth } from '@/features/auth/AuthContext'
import { ClientComments } from './ClientComments'
import { ClientMessages } from './ClientMessages'
import { Badge, ChannelBadge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { Select } from '@/components/Select'
import { supabase } from '@/lib/supabaseClient'
import { moveClientToStage, updateClient } from '@/lib/mutations'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const interestLabel: Record<string, string> = {
  real_estate: 'Real Estate',
  construction: 'Construcción',
  concierge: 'Concierge',
  other: 'Otro',
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-brand-charcoal/50 font-sans uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className="text-sm text-brand-dark font-sans">{value}</dd>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: client, isLoading } = useClient(id!)
  const { data: stages = [] } = usePipelineStages()
  const { data: agents = [] } = useProfiles()

  // Realtime: new messages appear without reload
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`messages-${id}-rt`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['messages', id] }) },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, queryClient])

  const updateStage = useMutation({
    mutationFn: ({ toStageId, fromStageId }: { toStageId: string; fromStageId: string | null }) =>
      moveClientToStage(id!, toStageId, fromStageId, user?.id ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const updateAgent = useMutation({
    mutationFn: (assignedTo: string | null) => updateClient(id!, { assigned_to: assignedTo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', id] }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="h-8 w-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-brand-charcoal/50 font-sans">Cliente no encontrado.</p>
        <Link to="/clients" className="text-brand-teal font-sans text-sm mt-2 inline-block hover:underline">
          ← Volver a clientes
        </Link>
      </div>
    )
  }

  const stage = client.pipeline_stages as { name: string; color: string } | null
  const assignee = client.profiles as { full_name: string; avatar_url: string | null } | null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-sans mb-6">
        <button onClick={() => navigate('/clients')} className="text-brand-charcoal/50 hover:text-brand-teal transition-colors">
          Clientes
        </button>
        <span className="text-brand-charcoal/30">/</span>
        <span className="text-brand-dark truncate max-w-xs">{client.full_name ?? 'Sin nombre'}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <Avatar name={client.full_name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl text-brand-dark">{client.full_name ?? 'Sin nombre'}</h1>
            <ChannelBadge channel={client.channel} />
            {stage && <Badge color={stage.color}>{stage.name}</Badge>}
          </div>
          <p className="text-brand-charcoal/50 font-sans text-sm mt-1">
            Lead desde {format(new Date(client.created_at), "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          {/* Contact info */}
          <div className="bg-white rounded-card border border-brand-light-gray p-5">
            <h3 className="font-display text-base text-brand-dark mb-4">Información de contacto</h3>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Teléfono" value={client.phone} />
              <InfoRow label="Email" value={client.email} />
              <InfoRow label="Interés" value={client.interest_type ? interestLabel[client.interest_type] : null} />
              <InfoRow label="Propiedad de interés" value={client.property_of_interest} />
              <InfoRow label="Presupuesto" value={client.budget_range} />
              <InfoRow label="Fuente" value={client.source} />
              <InfoRow
                label="Último contacto"
                value={client.last_contact_at
                  ? format(new Date(client.last_contact_at), "d MMM yyyy, HH:mm", { locale: es })
                  : null
                }
              />
            </dl>
          </div>

          {/* Stage selector */}
          <div className="bg-white rounded-card border border-brand-light-gray p-5">
            <h3 className="font-display text-base text-brand-dark mb-3">Etapa del pipeline</h3>
            <Select
              options={stages.map(s => ({ value: s.id, label: s.name }))}
              value={client.stage_id ?? ''}
              onChange={e => {
                updateStage.mutate({ toStageId: e.target.value, fromStageId: client.stage_id })
              }}
              placeholder="Sin etapa"
            />
            {updateStage.isPending && (
              <p className="text-xs text-brand-charcoal/40 font-sans mt-1.5">Guardando…</p>
            )}
          </div>

          {/* Agent selector */}
          <div className="bg-white rounded-card border border-brand-light-gray p-5">
            <h3 className="font-display text-base text-brand-dark mb-3">Agente asignado</h3>
            <div className="flex items-center gap-3 mb-3">
              {assignee ? (
                <>
                  <Avatar name={assignee.full_name} src={assignee.avatar_url} size="md" />
                  <span className="text-sm font-medium text-brand-dark font-sans">{assignee.full_name}</span>
                </>
              ) : (
                <span className="text-sm text-brand-charcoal/40 font-sans">Sin asignar</span>
              )}
            </div>
            <Select
              options={agents.map(a => ({ value: a.id, label: a.full_name }))}
              value={client.assigned_to ?? ''}
              onChange={e => updateAgent.mutate(e.target.value || null)}
              placeholder="Asignar agente…"
            />
            {updateAgent.isPending && (
              <p className="text-xs text-brand-charcoal/40 font-sans mt-1.5">Guardando…</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-card border border-brand-light-gray p-5">
            <ClientMessages clientId={client.id} />
          </div>
          <div className="bg-white rounded-card border border-brand-light-gray p-5">
            <ClientComments clientId={client.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
