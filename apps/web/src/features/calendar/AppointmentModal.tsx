import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useClients } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { useAuth } from '@/features/auth/AuthContext'
import { createAppointment, updateAppointment, deleteAppointment } from '@/lib/mutations'
import { syncAppointmentToGoogle, deleteAppointmentFromGoogle } from '@/hooks/useGoogleCalendar'
import { Select } from '@/components/Select'
import { TYPE_OPTIONS, STATUS_OPTIONS } from './appointmentMeta'
import type { AppointmentWithRelations } from '@/hooks/useAppointments'

interface AppointmentModalProps {
  open: boolean
  onClose: () => void
  /** Cita existente para editar; null/undefined = crear nueva */
  appointment?: AppointmentWithRelations | null
  /** Fecha preseleccionada al crear desde un día del calendario */
  defaultDate?: Date | null
  /** Cliente fijo al crear desde su ficha */
  lockedClientId?: string
}

const input =
  'w-full text-sm font-sans text-brand-dark bg-white border border-brand-light-gray rounded-button px-3 py-2 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/30'

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

function defaultStart(date?: Date | null): string {
  const base = date ? new Date(date) : new Date()
  // Si vino una fecha sin hora útil, fijar 9:00 por defecto
  if (date) base.setHours(9, 0, 0, 0)
  else base.setMinutes(0, 0, 0)
  return format(base, "yyyy-MM-dd'T'HH:mm")
}

export function AppointmentModal({ open, onClose, appointment, defaultDate, lockedClientId }: AppointmentModalProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const { data: clients = [] } = useClients({})
  const { data: agents = [] } = useProfiles()
  const isEdit = !!appointment

  const [clientId, setClientId] = useState(appointment?.client_id ?? lockedClientId ?? '')
  const [clientSearch, setClientSearch] = useState('')
  const [type, setType] = useState(appointment?.appointment_type ?? 'visit')
  const [startsAt, setStartsAt] = useState(toLocalInput(appointment?.starts_at) || defaultStart(defaultDate))
  const [endsAt, setEndsAt] = useState(toLocalInput(appointment?.ends_at))
  const [location, setLocation] = useState(appointment?.location ?? '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [assignedTo, setAssignedTo] = useState(appointment?.assigned_to ?? '')
  const [status, setStatus] = useState(appointment?.status ?? 'scheduled')
  const [error, setError] = useState<string | null>(null)

  const selectedClient = useMemo(
    () => clients.find(c => c.id === clientId) ?? null,
    [clients, clientId],
  )

  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase()
    const list = s
      ? clients.filter(c =>
          (c.full_name ?? '').toLowerCase().includes(s) ||
          (c.phone ?? '').toLowerCase().includes(s) ||
          (c.email ?? '').toLowerCase().includes(s),
        )
      : clients
    return list.slice(0, 8)
  }, [clients, clientSearch])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Selecciona un cliente para la cita.')
      if (!startsAt) throw new Error('Indica la fecha y hora de la cita.')
      const payload = {
        client_id: clientId,
        appointment_type: type,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        assigned_to: assignedTo || null,
        status,
      }
      if (isEdit && appointment) {
        await updateAppointment(appointment.id, payload)
        // Refleja el cambio en Google Calendar (best-effort; no bloquea el guardado).
        await syncAppointmentToGoogle(appointment.id)
      } else {
        const newId = await createAppointment({ ...payload, created_by: profile?.id ?? null })
        await syncAppointmentToGoogle(newId)
      }
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Error al guardar.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (appointment) {
        await deleteAppointmentFromGoogle(appointment.google_event_id)
        await deleteAppointment(appointment.id)
      }
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Error al eliminar.'),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray sticky top-0 bg-white z-10">
          <h2 className="font-sans font-semibold text-xl text-brand-dark">
            {isEdit ? 'Editar cita' : 'Nueva cita'}
          </h2>
          <button onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-dark transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Cliente */}
          <Field label="Cliente">
            {selectedClient && !lockedClientId ? (
              <div className="flex items-center justify-between gap-3 border border-brand-light-gray rounded-button px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-dark truncate">
                    {selectedClient.full_name ?? 'Sin nombre'}
                  </p>
                  {selectedClient.phone && (
                    <p className="text-xs text-brand-charcoal/50 truncate">{selectedClient.phone}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setClientId(''); setClientSearch('') }}
                  className="text-xs text-brand-teal hover:text-brand-deep font-medium flex-shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : lockedClientId && selectedClient ? (
              <div className="border border-brand-light-gray rounded-button px-3 py-2 bg-brand-light-gray/30">
                <p className="text-sm font-medium text-brand-dark truncate">
                  {selectedClient.full_name ?? 'Sin nombre'}
                </p>
              </div>
            ) : (
              <div>
                <input
                  className={input}
                  placeholder="Buscar cliente por nombre, teléfono o email…"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  autoFocus
                />
                {clientSearch.trim() && (
                  <div className="mt-1 border border-brand-light-gray rounded-button divide-y divide-brand-light-gray max-h-52 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-brand-charcoal/40">Sin resultados</p>
                    ) : (
                      filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setClientId(c.id); setClientSearch('') }}
                          className="w-full text-left px-3 py-2 hover:bg-brand-teal/[0.06] transition-colors"
                        >
                          <p className="text-sm text-brand-dark">{c.full_name ?? 'Sin nombre'}</p>
                          <p className="text-xs text-brand-charcoal/50">{c.phone ?? c.email ?? c.channel}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* Tipo + Estado (estado solo al editar) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de cita">
              <Select
                options={TYPE_OPTIONS}
                value={type}
                onChange={e => setType(e.target.value as typeof type)}
              />
            </Field>
            {isEdit && (
              <Field label="Estado">
                <Select
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={e => setStatus(e.target.value as typeof status)}
                />
              </Field>
            )}
          </div>

          {/* Fecha y horas */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio">
              <input className={input} type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Fin (opcional)">
              <input className={input} type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
            </Field>
          </div>

          {/* Lugar */}
          <Field label="Lugar / dirección">
            <input
              className={input}
              placeholder="Ej. Proyecto Las Brisas, oficina, link de video…"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </Field>

          {/* Agente */}
          <Field label="Agente asignado">
            <Select
              options={agents.map(a => ({ value: a.id, label: a.full_name }))}
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              placeholder="Sin asignar"
            />
          </Field>

          {/* Nota */}
          <Field label="Nota">
            <textarea
              className={input + ' min-h-[72px] resize-y'}
              placeholder="Detalles del seguimiento, acuerdos, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Field>

          {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-light-gray flex items-center justify-between gap-3 sticky bottom-0 bg-white">
          <div>
            {isEdit && (
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-3 py-2 text-sm font-sans text-red-500 hover:text-red-600 hover:bg-red-50 rounded-button transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-sans text-brand-charcoal/60 hover:text-brand-dark transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => { setError(null); saveMutation.mutate() }}
              disabled={saveMutation.isPending}
              className="px-5 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button hover:bg-brand-deep transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cita'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-brand-charcoal/60 font-sans uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}
