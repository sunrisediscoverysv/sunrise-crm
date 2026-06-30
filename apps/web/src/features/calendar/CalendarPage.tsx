import { useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isToday, format,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { useAppointments, type AppointmentWithRelations } from '@/hooks/useAppointments'
import { TYPE_COLOR, TYPE_LABEL, STATUS_COLOR, STATUS_LABEL } from './appointmentMeta'
import { AppointmentModal } from './AppointmentModal'

type View = 'month' | 'agenda'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AppointmentWithRelations | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | null>(null)

  // Rango de la cuadrícula del mes (incluye días de relleno de semanas adyacentes)
  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), [cursor])
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), [cursor])

  const { data: appointments = [], isLoading } = useAppointments({
    from: gridStart.toISOString(),
    to: gridEnd.toISOString(),
  })

  // Agrupar citas por día (clave YYYY-MM-DD)
  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>()
    for (const a of appointments) {
      const key = format(new Date(a.starts_at), 'yyyy-MM-dd')
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    }
    return map
  }, [appointments])

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  )

  function openNew(date?: Date | null) {
    setEditing(null)
    setDefaultDate(date ?? null)
    setModalOpen(true)
  }

  function openEdit(a: AppointmentWithRelations) {
    setEditing(a)
    setDefaultDate(null)
    setModalOpen(true)
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Calendario</h1>
            <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">
              {appointments.length} cita{appointments.length !== 1 ? 's' : ''} este mes
            </p>
          </div>
          <button
            onClick={() => openNew(new Date())}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep hover:-translate-y-px active:translate-y-0 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva cita
          </button>
        </div>

        {/* Toolbar: navegación de mes + toggle de vista */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(c => subMonths(c, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-button border border-brand-light-gray bg-white text-brand-charcoal/60 hover:text-brand-dark hover:bg-brand-light-gray/40 transition-colors"
              aria-label="Mes anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-sans font-semibold text-brand-dark text-base md:text-lg capitalize min-w-[150px] text-center">
              {format(cursor, 'MMMM yyyy', { locale: es })}
            </h2>
            <button
              onClick={() => setCursor(c => addMonths(c, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-button border border-brand-light-gray bg-white text-brand-charcoal/60 hover:text-brand-dark hover:bg-brand-light-gray/40 transition-colors"
              aria-label="Mes siguiente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="ml-1 px-3 h-9 text-sm font-sans text-brand-charcoal/70 border border-brand-light-gray rounded-button bg-white hover:bg-brand-light-gray/40 transition-colors"
            >
              Hoy
            </button>
          </div>

          {/* Toggle Mes / Agenda */}
          <div className="inline-flex p-0.5 bg-brand-light-gray/60 rounded-button">
            {(['month', 'agenda'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-4 py-1.5 text-sm font-sans font-medium rounded-[6px] transition-colors',
                  view === v ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-charcoal/55 hover:text-brand-dark',
                ].join(' ')}
              >
                {v === 'month' ? 'Mes' : 'Agenda'}
              </button>
            ))}
          </div>
        </div>

        {view === 'month' ? (
          <MonthGrid
            days={days}
            cursor={cursor}
            byDay={byDay}
            loading={isLoading}
            onDayClick={openNew}
            onAppointmentClick={openEdit}
          />
        ) : (
          <AgendaList
            days={days.filter(d => isSameMonth(d, cursor))}
            byDay={byDay}
            loading={isLoading}
            onAppointmentClick={openEdit}
            onAddOnDay={openNew}
          />
        )}
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={editing}
        defaultDate={defaultDate}
      />
    </div>
  )
}

// ── Vista de Mes ──────────────────────────────────────────────────────────────

function MonthGrid({
  days, cursor, byDay, loading, onDayClick, onAppointmentClick,
}: {
  days: Date[]
  cursor: Date
  byDay: Map<string, AppointmentWithRelations[]>
  loading: boolean
  onDayClick: (d: Date) => void
  onAppointmentClick: (a: AppointmentWithRelations) => void
}) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      {/* Cabecera de días */}
      <div className="grid grid-cols-7 border-b border-brand-light-gray">
        {WEEKDAYS.map(w => (
          <div key={w} className="px-2 py-2.5 text-center text-[11px] font-semibold font-sans text-brand-charcoal/40 uppercase tracking-wider">
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-brand-charcoal/40 font-sans">Cargando citas…</div>
      ) : (
        <div className="grid grid-cols-7">
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const items = byDay.get(key) ?? []
            const inMonth = isSameMonth(day, cursor)
            const today = isToday(day)
            return (
              <button
                key={key}
                onClick={() => onDayClick(day)}
                className={[
                  'text-left min-h-[84px] md:min-h-[112px] p-1.5 border-b border-r border-brand-light-gray/70 flex flex-col gap-1 transition-colors',
                  inMonth ? 'bg-white hover:bg-brand-teal/[0.03]' : 'bg-[#fafbfc] hover:bg-brand-light-gray/30',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-sans flex-shrink-0',
                    today ? 'bg-brand-teal text-white font-semibold' : inMonth ? 'text-brand-charcoal/70' : 'text-brand-charcoal/30',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </span>

                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {items.slice(0, 3).map(a => (
                    <span
                      key={a.id}
                      onClick={e => { e.stopPropagation(); onAppointmentClick(a) }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onAppointmentClick(a) } }}
                      className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] md:text-[11px] font-sans truncate hover:opacity-80"
                      style={{ backgroundColor: TYPE_COLOR[a.appointment_type] + '1a', color: TYPE_COLOR[a.appointment_type] }}
                      title={`${format(new Date(a.starts_at), 'HH:mm')} · ${a.clients?.full_name ?? 'Sin nombre'}`}
                    >
                      <span className="hidden md:inline tabular-nums font-medium">{format(new Date(a.starts_at), 'HH:mm')}</span>
                      <span className="w-1.5 h-1.5 rounded-full md:hidden flex-shrink-0" style={{ backgroundColor: TYPE_COLOR[a.appointment_type] }} />
                      <span className="truncate">{a.clients?.full_name ?? 'Sin nombre'}</span>
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="text-[10px] text-brand-charcoal/40 font-sans px-1">+{items.length - 3} más</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Vista de Agenda ──────────────────────────────────────────────────────────

function AgendaList({
  days, byDay, loading, onAppointmentClick, onAddOnDay,
}: {
  days: Date[]
  byDay: Map<string, AppointmentWithRelations[]>
  loading: boolean
  onAppointmentClick: (a: AppointmentWithRelations) => void
  onAddOnDay: (d: Date) => void
}) {
  const daysWithItems = days.filter(d => (byDay.get(format(d, 'yyyy-MM-dd')) ?? []).length > 0)

  if (loading) {
    return <div className="bg-white rounded-card shadow-card p-10 text-center text-sm text-brand-charcoal/40 font-sans">Cargando citas…</div>
  }

  if (daysWithItems.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card p-12 text-center">
        <p className="text-brand-charcoal/40 text-sm font-sans">No hay citas agendadas este mes.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {daysWithItems.map(day => {
        const key = format(day, 'yyyy-MM-dd')
        const items = byDay.get(key) ?? []
        const today = isToday(day)
        return (
          <div key={key} className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b border-brand-light-gray bg-[#f7f8f9]">
              <div className="flex items-center gap-2">
                <span className={['text-sm font-semibold font-sans capitalize', today ? 'text-brand-teal' : 'text-brand-dark'].join(' ')}>
                  {format(day, "EEEE d 'de' MMMM", { locale: es })}
                </span>
                {today && <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">Hoy</span>}
              </div>
              <button
                onClick={() => onAddOnDay(day)}
                className="text-xs text-brand-teal hover:text-brand-deep font-medium font-sans"
              >
                + Agregar
              </button>
            </div>
            <ul className="divide-y divide-brand-light-gray">
              {items.map(a => (
                <li key={a.id}>
                  <button
                    onClick={() => onAppointmentClick(a)}
                    className="w-full text-left flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-brand-teal/[0.03] transition-colors"
                  >
                    <div className="flex flex-col items-center w-12 flex-shrink-0">
                      <span className="text-sm font-semibold font-sans text-brand-dark tabular-nums">
                        {format(new Date(a.starts_at), 'HH:mm')}
                      </span>
                      {a.ends_at && (
                        <span className="text-[10px] text-brand-charcoal/40 tabular-nums">
                          {format(new Date(a.ends_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLOR[a.appointment_type] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark font-sans truncate">
                        {a.clients?.full_name ?? 'Sin nombre'}
                      </p>
                      <p className="text-xs text-brand-charcoal/50 font-sans truncate">
                        <span style={{ color: TYPE_COLOR[a.appointment_type] }}>{TYPE_LABEL[a.appointment_type]}</span>
                        {a.location ? ` · ${a.location}` : ''}
                        {a.profiles ? ` · ${a.profiles.full_name}` : ''}
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
      })}
    </div>
  )
}
