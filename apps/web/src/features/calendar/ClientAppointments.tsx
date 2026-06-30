import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useClientAppointments, type AppointmentWithRelations } from '@/hooks/useAppointments'
import { TYPE_COLOR, TYPE_LABEL, STATUS_COLOR, STATUS_LABEL } from './appointmentMeta'
import { AppointmentModal } from './AppointmentModal'

export function ClientAppointments({ clientId }: { clientId: string }) {
  const { data: appointments = [], isLoading } = useClientAppointments(clientId)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AppointmentWithRelations | null>(null)

  const now = Date.now()
  const upcoming = appointments.filter(a => new Date(a.starts_at).getTime() >= now && a.status === 'scheduled')
  const past = appointments.filter(a => !(new Date(a.starts_at).getTime() >= now && a.status === 'scheduled'))

  function openNew() { setEditing(null); setModalOpen(true) }
  function openEdit(a: AppointmentWithRelations) { setEditing(a); setModalOpen(true) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold font-sans text-brand-charcoal/45 uppercase tracking-wider">Citas</h3>
        <button onClick={openNew} className="text-xs text-brand-teal hover:text-brand-deep font-medium font-sans">
          + Nueva cita
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-brand-charcoal/40 font-sans py-2">Cargando…</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-brand-charcoal/40 font-sans py-2">Sin citas agendadas. Agenda la primera con «Nueva cita».</p>
      ) : (
        <div className="flex flex-col gap-4">
          {upcoming.length > 0 && (
            <Section title="Próximas" items={upcoming} onClick={openEdit} />
          )}
          {past.length > 0 && (
            <Section title="Historial" items={past} onClick={openEdit} muted />
          )}
        </div>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={editing}
        lockedClientId={clientId}
      />
    </div>
  )
}

function Section({
  title, items, onClick, muted,
}: {
  title: string
  items: AppointmentWithRelations[]
  onClick: (a: AppointmentWithRelations) => void
  muted?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] font-sans text-brand-charcoal/40 uppercase tracking-wider mb-1.5">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map(a => (
          <li key={a.id}>
            <button
              onClick={() => onClick(a)}
              className={[
                'w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-teal/[0.04]',
                muted ? 'bg-[#fafbfc]' : 'bg-[#f7f8f9]',
              ].join(' ')}
            >
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLOR[a.appointment_type] }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-dark font-sans">
                  {format(new Date(a.starts_at), "EEE d MMM · HH:mm", { locale: es })}
                </p>
                <p className="text-xs text-brand-charcoal/50 font-sans truncate">
                  <span style={{ color: TYPE_COLOR[a.appointment_type] }}>{TYPE_LABEL[a.appointment_type]}</span>
                  {a.location ? ` · ${a.location}` : ''}
                </p>
              </div>
              <span
                className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLOR[a.status] + '1a', color: STATUS_COLOR[a.status] }}
              >
                {STATUS_LABEL[a.status]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
