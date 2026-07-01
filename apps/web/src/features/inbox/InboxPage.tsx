import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { updateClient } from '@/lib/mutations'
import { ChatPanel } from '@/features/whatsapp/ChatPanel'
import { computeWhatsappWindow } from '@/features/whatsapp/whatsappWindow'
import { useInboxConversations, type Conversation } from './useInboxConversations'

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
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
                  ? `Tú: ${c.lastMessage.content ?? ''}`
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
                        <div className="w-11 h-11 rounded-full bg-brand-dark/90 flex items-center justify-center">
                          <span className="text-sm font-semibold text-white font-sans">
                            {(c.client.full_name?.[0] ?? '?').toUpperCase()}
                          </span>
                        </div>
                        {c.client.channel === 'whatsapp' && win.open && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-white" title="Ventana de 24h abierta" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate font-sans text-sm ${c.unread ? 'font-semibold text-brand-dark' : 'font-medium text-brand-charcoal'}`}>
                            {c.client.full_name ?? c.client.phone ?? 'Sin nombre'}
                          </p>
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
            {/* Cabecera del hilo */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-brand-light-gray flex-shrink-0">
              <button
                onClick={() => setSelectedId(null)}
                className="md:hidden text-brand-charcoal/50 hover:text-brand-dark p-1 -ml-1"
                aria-label="Volver"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-9 h-9 rounded-full bg-brand-dark/90 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-white font-sans">
                  {(selected.client.full_name?.[0] ?? '?').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans font-semibold text-sm text-brand-dark">
                  {selected.client.full_name ?? selected.client.phone ?? 'Sin nombre'}
                </p>
                <p className="truncate text-xs font-sans text-brand-charcoal/45">
                  {channelLabel[selected.client.channel] ?? selected.client.channel}
                  {selected.client.phone ? ` · ${selected.client.phone}` : ''}
                </p>
              </div>
              <Link
                to={`/clients/${selected.client.id}`}
                className="text-xs font-sans text-brand-teal hover:text-brand-deep font-medium flex-shrink-0"
              >
                Ver ficha
              </Link>
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
    </div>
  )
}
