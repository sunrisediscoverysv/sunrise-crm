import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClient } from '@/hooks/useClients'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useProfiles } from '@/hooks/useProfiles'
import { useProperties } from '@/hooks/useProperties'
import { useAuth } from '@/features/auth/AuthContext'
import { ClientComments } from './ClientComments'
import { ChatPanel } from '@/features/whatsapp/ChatPanel'
import { ClientAttachments } from './ClientAttachments'
import { ClientAppointments } from '@/features/calendar/ClientAppointments'
import { SendTemplateModal } from '@/features/whatsapp/SendTemplateModal'
import { Badge, ChannelBadge } from '@/components/Badge'
import { Avatar } from '@/components/Avatar'
import { Select } from '@/components/Select'
import { supabase } from '@/lib/supabaseClient'
import { moveClientToStage, updateClient, deleteClient } from '@/lib/mutations'
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  const { data: client, isLoading } = useClient(id!)
  const { data: stages = [] } = usePipelineStages()
  const { data: agents = [] } = useProfiles()
  const { data: properties = [] } = useProperties()

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

  const updateFollowUp = useMutation({
    mutationFn: (date: string | null) => updateClient(id!, { follow_up_at: date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', id] }),
  })

  // Only offer properties that are still on the market. Keep the client's
  // currently-linked property visible even if it was later archived.
  const assignableProperties = useMemo(() => {
    const active = properties.filter(p => p.status === 'available' || p.status === 'reserved')
    const linkedId = client?.property_id
    if (linkedId && !active.some(p => p.id === linkedId)) {
      const cur = properties.find(p => p.id === linkedId)
      if (cur) return [cur, ...active]
    }
    return active
  }, [properties, client?.property_id])

  const updateProperty = useMutation({
    mutationFn: (propertyId: string | null) => updateClient(id!, { property_id: propertyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['property-lead-counts'] })
    },
  })

  const removeClient = useMutation({
    mutationFn: () => deleteClient(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/clients')
    },
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
  const linkedProperty = client.property ?? properties.find(p => p.id === client.property_id) ?? null

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
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
            <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">{client.full_name ?? 'Sin nombre'}</h1>
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
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-4">Información de contacto</h3>
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
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-3">Etapa del pipeline</h3>
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

          {/* Property of interest */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-3">Propiedad de interés</h3>
            <Select
              options={assignableProperties.map(p => ({ value: p.id, label: p.name }))}
              value={client.property_id ?? ''}
              onChange={e => updateProperty.mutate(e.target.value || null)}
              placeholder="Vincular propiedad…"
            />
            {linkedProperty && (
              <a
                href={linkedProperty.source_url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-xl bg-[#f7f8f9] p-3 hover:bg-brand-teal/[0.05] transition-colors"
              >
                <p className="text-sm font-semibold text-brand-dark font-sans leading-snug">{linkedProperty.name}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-sans text-brand-charcoal/55">
                  {linkedProperty.price_label && <span className="text-brand-teal font-semibold">{linkedProperty.price_label}</span>}
                  {linkedProperty.size_label && <span>· {linkedProperty.size_label}</span>}
                </div>
                {linkedProperty.location && <p className="text-xs text-brand-charcoal/45 font-sans mt-0.5">{linkedProperty.location}</p>}
              </a>
            )}
            {!client.property_id && client.property_of_interest && (
              <p className="text-xs text-brand-charcoal/45 font-sans mt-2">
                El bot registró: <span className="text-brand-charcoal/70">«{client.property_of_interest}»</span>
              </p>
            )}
            {updateProperty.isPending && <p className="text-xs text-brand-charcoal/40 font-sans mt-1.5">Guardando…</p>}
          </div>

          {/* Follow-up date */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-3">Próximo seguimiento</h3>
            {client.follow_up_at && (
              <p className={[
                'text-xs font-sans mb-2 flex items-center gap-1',
                new Date(client.follow_up_at) < new Date() ? 'text-red-500' : 'text-brand-charcoal/60',
              ].join(' ')}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(client.follow_up_at) < new Date() ? 'Vencido: ' : ''}
                {new Date(client.follow_up_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
            <div className="flex gap-2 items-center">
              <input
                type="date"
                defaultValue={client.follow_up_at ? client.follow_up_at.slice(0, 10) : ''}
                onChange={e => updateFollowUp.mutate(e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null)}
                className="flex-1 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button px-3 py-2 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
              />
              {client.follow_up_at && (
                <button onClick={() => updateFollowUp.mutate(null)} className="text-xs text-brand-charcoal/40 hover:text-red-500 transition-colors font-sans">
                  ✕
                </button>
              )}
            </div>
            {updateFollowUp.isPending && <p className="text-xs text-brand-charcoal/40 font-sans mt-1">Guardando…</p>}
          </div>

          {/* Agent selector */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-3">Agente asignado</h3>
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

          {/* WhatsApp template */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-3">WhatsApp</h3>
            <p className="text-xs text-brand-charcoal/55 font-sans mb-3 leading-relaxed">
              Reabre la conversación después de las 24h enviando una plantilla aprobada por Meta.
            </p>
            <button
              onClick={() => setTemplateOpen(true)}
              disabled={!client.phone}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-medium font-sans rounded-button hover:bg-[#1da851] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.115z"/>
              </svg>
              Enviar plantilla
            </button>
            {!client.phone && (
              <p className="text-xs text-brand-charcoal/40 font-sans mt-2">Sin número de WhatsApp registrado.</p>
            )}
          </div>

          {/* Delete */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider mb-3">Zona de peligro</h3>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-2 text-sm font-sans text-red-500/80 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar cliente
              </button>
            ) : (
              <div>
                <p className="text-xs font-sans text-brand-charcoal/60 mb-3">
                  ¿Eliminar a <span className="font-semibold text-brand-dark">{client.full_name ?? 'este cliente'}</span>? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => removeClient.mutate()}
                    disabled={removeClient.isPending}
                    className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold font-sans rounded-button transition-colors disabled:opacity-60"
                  >
                    {removeClient.isPending ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 px-3 py-1.5 bg-brand-light-gray hover:bg-brand-light-gray/80 text-brand-charcoal/70 text-xs font-semibold font-sans rounded-button transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-card shadow-card p-5 flex flex-col">
            <h3 className="font-sans font-semibold text-lg text-brand-dark mb-4">Conversación</h3>
            <ChatPanel
              client={{ id: client.id, full_name: client.full_name, phone: client.phone, channel: client.channel }}
              className="h-[32rem]"
            />
          </div>
          <div className="bg-white rounded-card shadow-card p-5">
            <ClientAppointments clientId={client.id} />
          </div>
          <div className="bg-white rounded-card shadow-card p-5">
            <ClientComments clientId={client.id} />
          </div>
          <div className="bg-white rounded-card shadow-card p-5">
            <ClientAttachments clientId={client.id} />
          </div>
        </div>
      </div>
    </div>

    <SendTemplateModal
      open={templateOpen}
      onClose={() => setTemplateOpen(false)}
      client={{ id: client.id, full_name: client.full_name, phone: client.phone }}
    />
    </div>
  )
}
