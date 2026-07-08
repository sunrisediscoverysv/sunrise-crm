import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { updateClient } from '@/lib/mutations'
import { ChatPanel } from '@/features/whatsapp/ChatPanel'
import { computeWhatsappWindow } from '@/features/whatsapp/whatsappWindow'
import { AppointmentModal } from '@/features/calendar/AppointmentModal'
import { useInboxConversations, type Conversation } from './useInboxConversations'
import { RegisterClientModal } from './RegisterClientModal'
import { needsName } from '@/lib/clientName'

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
}

// Marca de canal para la esquina del avatar en la lista de conversaciones.
const CHANNEL_BADGE: Record<string, { bg: string; icon: React.ReactNode }> = {
  whatsapp: {
    bg: '#25D366',
    icon: <path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.9c0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.9 9.9 0 004.73 1.2h.01c5.46 0 9.9-4.45 9.9-9.9C21.94 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.42 1.32-1.95 1.36-.5.05-.5.4-3.16-.66-2.67-1.06-4.32-3.8-4.45-3.98-.13-.18-1.06-1.4-1.06-2.68 0-1.27.67-1.9.9-2.16.24-.26.52-.32.7-.32l.5.01c.16 0 .38-.06.6.46.22.53.76 1.83.83 1.96.07.13.11.29.02.47-.09.18-.13.29-.26.44l-.4.46c-.13.13-.26.27-.11.53.15.26.66 1.09 1.42 1.76.98.87 1.8 1.14 2.06 1.27.26.13.41.11.56-.07.15-.18.65-.76.82-1.02.17-.26.35-.22.58-.13.24.09 1.52.72 1.78.85.26.13.43.2.5.31.06.11.06.64-.18 1.32z" />,
  },
  instagram: {
    bg: 'linear-gradient(45deg,#feda75,#d62976 45%,#962fbf 80%,#4f5bd5)',
    icon: <><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="16.6" cy="7.4" r="1.2" fill="currentColor" /></>,
  },
  messenger: {
    bg: '#0084FF',
    icon: <path fill="currentColor" d="M12 2C6.3 2 2 6.2 2 11.7c0 3 1.4 5.6 3.7 7.4V22l3.4-1.9c.9.25 1.9.4 2.9.4 5.7 0 10-4.2 10-9.7C22 6.2 17.7 2 12 2zm1 12.1l-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7z" />,
  },
}

function ChannelDot({ channel }: { channel: string }) {
  const meta = CHANNEL_BADGE[channel]
  if (!meta) return null
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-white"
      style={{ background: meta.bg }}
      title={channelLabel[channel] ?? channel}
    >
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5">{meta.icon}</svg>
    </span>
  )
}

function listTime(iso: string): string {
  const d = new Date(iso)
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd MMM', { locale: es })
}

export function InboxPage() {
  const queryClient = useQueryClient()
  const { data: conversations = [], isLoading } = useInboxConversations()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [registerFor, setRegisterFor] = useState<Conversation['client'] | null>(null)
  const [appointmentFor, setAppointmentFor] = useState<string | null>(null)

  // Filtro por nombre o teléfono. Para el teléfono comparamos solo dígitos, así
  // "7000 1234", "+503 70001234" o "70001234" encuentran el mismo contacto.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    const qDigits = q.replace(/\D/g, '')
    return conversations.filter(c => {
      const name = (c.client.full_name ?? '').toLowerCase()
      const phone = c.client.phone ?? ''
      const phoneDigits = phone.replace(/\D/g, '')
      return (
        name.includes(q) ||
        phone.toLowerCase().includes(q) ||
        (qDigits.length > 0 && phoneDigits.includes(qDigits))
      )
    })
  }, [conversations, query])

  // Realtime: cualquier mensaje nuevo refresca la bandeja y el hilo afectado.
  useEffect(() => {
    const channel = supabase
      .channel('inbox-messages-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['inbox'] })
          const cid = (payload.new as { client_id?: string })?.client_id
          if (cid) queryClient.invalidateQueries({ queryKey: ['messages', cid] })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const markRead = useMutation({
    mutationFn: (clientId: string) =>
      updateClient(clientId, { agent_last_read_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  })

  function openConversation(c: Conversation) {
    setSelectedId(c.client.id)
    if (c.unread) markRead.mutate(c.client.id)
  }

  const selected = useMemo(
    () => conversations.find(c => c.client.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  return (
    <div className="h-full flex min-h-0 bg-[#f7f8f9]">
      {/* ── Lista de conversaciones ─────────────────────────────────────────── */}
      <div
        className={[
          'flex-col min-h-0 w-full md:w-80 lg:w-96 md:flex bg-white border-r border-brand-light-gray',
          selectedId ? 'hidden' : 'flex',
        ].join(' ')}
      >
        <div className="px-5 py-4 border-b border-brand-light-gray flex-shrink-0">
          <h1 className="font-display text-2xl text-brand-dark leading-tight">Conversaciones</h1>
          <p className="text-brand-charcoal/50 font-sans text-xs mt-0.5 mb-3">Chats de WhatsApp y otros canales</p>
          <div className="relative">
            <svg className="w-4 h-4 text-brand-charcoal/35 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              inputMode="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              className="w-full text-sm font-sans text-brand-dark bg-brand-light-gray/40 border border-transparent rounded-button pl-9 pr-8 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/35"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-charcoal/35 hover:text-brand-dark p-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 bg-brand-light-gray rounded-card animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-brand-charcoal/40 font-sans py-10 px-5 text-center">
              Aún no hay conversaciones.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-brand-charcoal/40 font-sans py-10 px-5 text-center">
              Sin resultados para «{query.trim()}».
            </p>
          ) : (
            <ul>
              {filtered.map(c => {
                const isSel = c.client.id === selectedId
                const preview = c.lastMessage.direction === 'outbound'
                  ? `${c.lastMessage.sender ?? 'Tú'}: ${c.lastMessage.content ?? ''}`
                  : (c.lastMessage.content ?? '—')
                const win = computeWhatsappWindow(c.lastInboundAt)
                return (
                  <li key={c.client.id}>
                    <button
                      onClick={() => openConversation(c)}
                      className={[
                        'w-full text-left flex items-center gap-3 px-4 py-3 border-b border-brand-light-gray/60 transition-colors',
                        isSel ? 'bg-brand-teal/10' : 'hover:bg-brand-light-gray/40',
                      ].join(' ')}
                    >
                      <div className="relative flex-shrink-0">
                        <div className={[
                          'w-11 h-11 rounded-full bg-brand-dark/90 flex items-center justify-center',
                          c.client.channel === 'whatsapp' && win.open ? 'ring-2 ring-[#25D366] ring-offset-1' : '',
                        ].join(' ')}>
                          <span className="text-sm font-semibold text-white font-sans">
                            {(c.client.full_name?.[0] ?? '?').toUpperCase()}
                          </span>
                        </div>
                        <ChannelDot channel={c.client.channel} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 flex items-center gap-1.5">
                            <p className={`truncate font-sans text-sm ${c.unread ? 'font-semibold text-brand-dark' : 'font-medium text-brand-charcoal'}`}>
                              {c.client.full_name ?? c.client.phone ?? 'Sin nombre'}
                            </p>
                            {needsName(c.client) && (
                              <span className="flex-shrink-0 text-[10px] font-sans font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-px leading-4">
                                Agregar nombre
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-sans text-brand-charcoal/40 flex-shrink-0">
                            {listTime(c.lastMessage.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`truncate text-xs font-sans ${c.unread ? 'text-brand-charcoal/70' : 'text-brand-charcoal/45'}`}>
                            {preview}
                          </p>
                          {c.unread && <span className="w-2.5 h-2.5 rounded-full bg-brand-teal flex-shrink-0" />}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Hilo seleccionado ───────────────────────────────────────────────── */}
      <div
        className={[
          'flex-1 min-w-0 flex-col min-h-0 md:flex',
          selectedId ? 'flex' : 'hidden',
        ].join(' ')}
      >
        {selected ? (
          <>
            {/* Cabecera del hilo. En móvil las acciones bajan a una segunda
                fila (flex-wrap + w-full) para que el nombre y el chip de "no
                registrado" no queden montados entre los botones. */}
            <div className="flex items-center gap-x-3 gap-y-2 px-4 py-3 bg-white border-b border-brand-light-gray flex-shrink-0 flex-wrap">
              <button
                onClick={() => setSelectedId(null)}
                className="md:hidden text-brand-charcoal/50 hover:text-brand-dark p-1 -ml-1"
                aria-label="Volver"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative w-9 h-9 flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-brand-dark/90 flex items-center justify-center">
                  <span className="text-sm font-semibold text-white font-sans">
                    {(selected.client.full_name?.[0] ?? '?').toUpperCase()}
                  </span>
                </div>
                <ChannelDot channel={selected.client.channel} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="truncate font-sans font-semibold text-sm text-brand-dark">
                    {selected.client.full_name ?? selected.client.phone ?? 'Sin nombre'}
                  </p>
                  {needsName(selected.client) && (
                    <button
                      onClick={() => setRegisterFor(selected.client)}
                      title="Este contacto ya es cliente; solo falta ponerle nombre"
                      className="flex-shrink-0 whitespace-nowrap text-[10px] font-sans font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-px leading-4 hover:bg-amber-100 hover:border-amber-300 transition-colors"
                    >
                      + Agregar nombre
                    </button>
                  )}
                </div>
                <p className="truncate text-xs font-sans text-brand-charcoal/45">
                  {channelLabel[selected.client.channel] ?? selected.client.channel}
                  {selected.client.phone ? ` · ${selected.client.phone}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setAppointmentFor(selected.client.id)}
                  title="Agendar cita"
                  aria-label="Agendar cita"
                  className="text-brand-charcoal/45 hover:text-brand-teal hover:bg-brand-teal/10 rounded-button p-1.5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v4m-2-2h4" />
                  </svg>
                </button>
                <Link
                  to={`/clients/${selected.client.id}`}
                  className="text-xs font-sans text-brand-teal hover:text-brand-deep font-medium whitespace-nowrap"
                >
                  Ver ficha
                </Link>
              </div>
            </div>

            <ChatPanel
              key={selected.client.id}
              client={{
                id: selected.client.id,
                full_name: selected.client.full_name,
                phone: selected.client.phone,
                channel: selected.client.channel,
              }}
              className="flex-1 min-h-0 px-4 pb-4 pt-3"
            />
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-brand-light-gray flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-brand-charcoal/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.83l-5 1.66 1.7-4.24A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-sans text-brand-charcoal/45">Elige una conversación para empezar</p>
            </div>
          </div>
        )}
      </div>

      {registerFor && (
        <RegisterClientModal
          key={registerFor.id}
          open
          onClose={() => setRegisterFor(null)}
          client={registerFor}
        />
      )}

      {appointmentFor && (
        <AppointmentModal
          key={appointmentFor}
          open
          onClose={() => setAppointmentFor(null)}
          lockedClientId={appointmentFor}
        />
      )}
    </div>
  )
}
