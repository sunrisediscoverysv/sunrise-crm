import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabaseClient'
import { functionsErrorMessage } from '@/lib/functions'
import type { Message } from '@/types/database'
import { SendTemplateModal } from './SendTemplateModal'
import {
  computeWhatsappWindow,
  formatWindowRemaining,
  lastInboundAt,
} from './whatsappWindow'
import { ChatMediaPreview } from './ChatMediaPreview'
import {
  CHAT_MEDIA_BUCKET,
  MEDIA_KIND_LABEL,
  WHATSAPP_MEDIA_ACCEPT,
  chatMediaPath,
  formatFileSize,
  messageMedia,
  validateWhatsappMedia,
  whatsappMediaKind,
} from './whatsappMedia'

export interface ChatClient {
  id: string
  full_name: string | null
  phone: string | null
  channel: string
}

interface ChatPanelProps {
  client: ChatClient
  /** Clase de la caja externa; controla la altura del panel. */
  className?: string
}

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
}

// Etiqueta legible del estado de entrega de WhatsApp (columna wa_status).
// 'accepted' = Meta aceptó el envío pero aún no confirma que salió: se muestra
// con relojito hasta que el webhook de entrega lo suba a sent/delivered/read.
const waStatusLabel: Record<string, string> = {
  accepted: 'Enviando…', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'No entregado',
}

function waErrorText(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { title?: string; message?: string; details?: string; code?: number }
  const parts = [e.title || e.message, e.details].filter(Boolean)
  const base = parts.join(' — ') || 'Falló el envío'
  return e.code ? `${base} (código ${e.code})` : base
}

// Quién envió un outbound: el bot o un agente desde Chatwoot (agent_name en
// raw_payload). Los enviados desde el CRM no traen remitente y se muestran
// sin etiqueta, como hasta ahora.
function outboundSender(msg: Message): string | null {
  const p = msg.raw_payload as { source?: string; agent_name?: string | null; bot?: boolean } | null
  if (!p || p.source !== 'chatwoot') return null
  if (p.bot) return p.agent_name ? `Bot (${p.agent_name})` : 'Bot'
  return p.agent_name ?? null
}

function useMessages(clientId: string) {
  return useQuery({
    queryKey: ['messages', clientId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function ChatPanel({ client, className }: ChatPanelProps) {
  const queryClient = useQueryClient()
  const { data: messages = [], isLoading } = useMessages(client.id)
  const [draft, setDraft] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isWhatsapp = client.channel === 'whatsapp'
  // Instagram y Messenger se responden a través de la API de Chatwoot.
  const viaChatwoot = client.channel === 'instagram' || client.channel === 'messenger'
  const canReply = isWhatsapp || viaChatwoot
  const channelName = client.channel === 'instagram' ? 'Instagram'
    : client.channel === 'messenger' ? 'Messenger' : 'WhatsApp'

  // Recalcular la ventana de 24h cada minuto para el contador en vivo.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const win = useMemo(
    () => computeWhatsappWindow(lastInboundAt(messages), nowTick),
    [messages, nowTick],
  )

  // Realtime del hilo: los INSERT ya los cubre la suscripción del inbox, pero
  // los cambios de estado de entrega (wa_status: relojito → enviado/entregado/
  // leído/fallido) llegan como UPDATE del webhook de Meta y nadie más los
  // escucha. Filtrado por cliente para no refetchear hilos ajenos.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-rt-${client.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${client.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['messages', client.id] }),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [client.id, queryClient])

  // Auto-scroll al último mensaje cuando cambian.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const send = useMutation({
    mutationFn: async ({ text, attachment }: { text: string; attachment: File | null }) => {
      if (isWhatsapp && attachment) {
        if (!client.phone) throw new Error('Este cliente no tiene número de WhatsApp.')
        // El navegador sube el archivo al bucket privado; la Edge Function lo
        // toma de ahí, lo sube a Meta y lo registra en el historial.
        const path = chatMediaPath(client.id, attachment.name)
        const { error: upErr } = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(path, attachment, { contentType: attachment.type || undefined })
        if (upErr) throw new Error(`No se pudo subir el archivo: ${upErr.message}`)
        const { error } = await supabase.functions.invoke('whatsapp', {
          body: {
            action: 'media',
            client_id: client.id,
            to: client.phone,
            storage_path: path,
            file_name: attachment.name,
            mime_type: attachment.type || 'application/octet-stream',
            caption: text,
          },
        })
        if (error) throw new Error(await functionsErrorMessage(error, 'No se pudo enviar el archivo.'))
      } else if (isWhatsapp) {
        if (!client.phone) throw new Error('Este cliente no tiene número de WhatsApp.')
        const { error } = await supabase.functions.invoke('whatsapp', {
          body: { action: 'text', client_id: client.id, to: client.phone, text },
        })
        if (error) throw new Error(await functionsErrorMessage(error, 'No se pudo enviar el mensaje.'))
      } else if (viaChatwoot) {
        const { error } = await supabase.functions.invoke('chatwoot-send', {
          body: { client_id: client.id, text },
        })
        if (error) throw new Error(await functionsErrorMessage(error, 'No se pudo enviar el mensaje.'))
      } else {
        throw new Error('Este canal no permite responder desde el CRM.')
      }
    },
    onSuccess: () => {
      setDraft('')
      setFile(null)
      queryClient.invalidateQueries({ queryKey: ['messages', client.id] })
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })

  const composerDisabled = !canReply || (isWhatsapp && !client.phone) || !win.open || send.isPending

  function submit() {
    const text = draft.trim()
    if ((!text && !file) || composerDisabled) return
    send.mutate({ text, attachment: file })
  }

  function pickFile(picked: File | null | undefined) {
    if (!picked) return
    const problem = validateWhatsappMedia(picked)
    setFileError(problem)
    setFile(problem ? null : picked)
    send.reset()
  }

  const fileKind = file ? whatsappMediaKind(file.type) : null
  const filePreviewUrl = useMemo(
    () => (file && fileKind === 'image' ? URL.createObjectURL(file) : null),
    [file, fileKind],
  )
  useEffect(() => () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl) }, [filePreviewUrl])

  return (
    <div className={`flex flex-col min-h-0 ${className ?? ''}`}>
      {/* Hilo de mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-1">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-brand-light-gray rounded-card animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-brand-charcoal/40 font-sans py-8 text-center">
            Sin mensajes todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map(msg => {
              const isInbound = msg.direction === 'inbound'
              const attached = messageMedia(msg.raw_payload)
              // Con adjunto, `content` es solo la etiqueta para la bandeja
              // ("[Imagen] …"); en el hilo se pinta el archivo + su caption.
              const bodyText = attached ? attached.caption : msg.content
              return (
                <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={[
                      'max-w-[80%] rounded-card px-3.5 py-2.5',
                      isInbound
                        ? 'bg-white border border-brand-light-gray'
                        : 'bg-brand-dark text-white',
                    ].join(' ')}
                  >
                    {attached && (
                      <div className={bodyText ? 'mb-1.5' : ''}>
                        <ChatMediaPreview media={attached.media} onDark={!isInbound} />
                      </div>
                    )}
                    {bodyText && (
                      <p className={`text-sm font-serif leading-relaxed whitespace-pre-wrap break-words ${isInbound ? 'text-brand-charcoal' : 'text-white'}`}>
                        {bodyText}
                      </p>
                    )}
                    <div className={`flex items-center gap-2 mt-1 ${isInbound ? '' : 'justify-end'}`}>
                      <span className={`text-xs font-sans ${isInbound ? 'text-brand-charcoal/40' : 'text-white/50'}`}>
                        {!isInbound && outboundSender(msg) && (
                          <>{outboundSender(msg)}{' · '}</>
                        )}
                        {channelLabel[msg.channel] ?? msg.channel}
                        {' · '}
                        {format(new Date(msg.created_at), 'dd MMM · HH:mm', { locale: es })}
                        {!isInbound && msg.wa_status && waStatusLabel[msg.wa_status] && (
                          <>{' · '}
                            <span
                              className={[
                                'inline-flex items-center gap-1 align-bottom',
                                msg.wa_status === 'failed' ? 'text-red-300 font-medium' : '',
                              ].join(' ')}
                            >
                              {msg.wa_status === 'accepted' && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                                </svg>
                              )}
                              {waStatusLabel[msg.wa_status]}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    {!isInbound && msg.wa_status === 'failed' && waErrorText(msg.wa_error) && (
                      <p className="text-[11px] font-sans text-red-200 mt-1 leading-snug">
                        {waErrorText(msg.wa_error)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Zona de composición / estado de la ventana */}
      <div className="pt-3 mt-2 border-t border-brand-light-gray">
        {!canReply ? (
          <p className="text-xs text-brand-charcoal/45 font-sans text-center py-2">
            Este canal no permite responder desde el CRM.
          </p>
        ) : isWhatsapp && !client.phone ? (
          <p className="text-xs text-brand-charcoal/45 font-sans text-center py-2">
            Sin número de WhatsApp registrado.
          </p>
        ) : win.open ? (
          <>
            {isWhatsapp && file && fileKind && (
              <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-brand-light-gray/50 border border-brand-light-gray rounded-card">
                {filePreviewUrl ? (
                  <img src={filePreviewUrl} alt="" className="w-12 h-12 object-cover rounded-md shrink-0" />
                ) : (
                  <span className="w-12 h-12 flex items-center justify-center rounded-md bg-white text-brand-teal shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-sans font-medium text-brand-dark truncate">{file.name}</p>
                  <p className="text-xs font-sans text-brand-charcoal/50">
                    {MEDIA_KIND_LABEL[fileKind]} · {formatFileSize(file.size)}
                    {fileKind === 'audio' && ' · WhatsApp no admite texto junto al audio'}
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  disabled={send.isPending}
                  aria-label="Quitar archivo"
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-brand-charcoal/50 hover:bg-white hover:text-brand-dark transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              {isWhatsapp && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={WHATSAPP_MEDIA_ACCEPT}
                    className="hidden"
                    onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={composerDisabled}
                    aria-label="Adjuntar archivo"
                    title="Adjuntar imagen, video, audio o documento"
                    className="shrink-0 w-11 h-11 flex items-center justify-center text-brand-charcoal/60 border border-brand-light-gray rounded-card hover:text-brand-teal hover:border-brand-teal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </button>
                </>
              )}
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
                }}
                onPaste={e => {
                  // Pegar una captura/imagen la adjunta directamente.
                  const pasted = isWhatsapp ? e.clipboardData.files?.[0] : undefined
                  if (pasted) { e.preventDefault(); pickFile(pasted) }
                }}
                rows={1}
                disabled={isWhatsapp && fileKind === 'audio'}
                placeholder={file ? 'Añade un comentario (opcional)…' : 'Escribe un mensaje…'}
                className="flex-1 resize-none max-h-32 text-sm font-sans text-brand-dark bg-white border border-brand-light-gray rounded-card px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/30"
              />
              <button
                onClick={submit}
                disabled={composerDisabled || (!draft.trim() && !file)}
                aria-label="Enviar"
                className="shrink-0 w-11 h-11 flex items-center justify-center bg-brand-teal text-white rounded-card hover:bg-brand-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {send.isPending ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.3 4.5a.6.6 0 01.82-.73l15.5 7.5a.6.6 0 010 1.08l-15.5 7.5a.6.6 0 01-.82-.73L6 12zm0 0h6" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] font-sans text-brand-charcoal/40">
                Ventana de 24h abierta · quedan {formatWindowRemaining(win.msRemaining)}
              </span>
              {(send.isError || fileError) && (
                <span className="text-[11px] font-sans text-red-500">
                  {fileError ?? (send.error as Error).message}
                </span>
              )}
            </div>
          </>
        ) : isWhatsapp ? (
          <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3">
            <p className="text-xs font-sans text-amber-800 leading-relaxed mb-2.5">
              {win.lastInboundAt
                ? 'Pasaron más de 24h desde el último mensaje del cliente. Para escribirle de nuevo debes enviar una plantilla aprobada.'
                : 'El cliente aún no ha escrito. Para iniciar la conversación por WhatsApp debes enviar una plantilla aprobada.'}
            </p>
            <button
              onClick={() => setTemplateOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-medium font-sans rounded-button hover:bg-[#1da851] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.115z" />
              </svg>
              Enviar plantilla
            </button>
          </div>
        ) : (
          <p className="text-xs text-brand-charcoal/45 font-sans text-center py-3 leading-relaxed">
            {win.lastInboundAt
              ? `Pasaron más de 24h desde el último mensaje. En ${channelName} solo puedes responder dentro de las 24h; espera a que el cliente vuelva a escribir.`
              : `Aún no puedes escribir por ${channelName}: espera a que el cliente inicie la conversación.`}
          </p>
        )}
      </div>

      <SendTemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        client={{ id: client.id, full_name: client.full_name, phone: client.phone }}
      />
    </div>
  )
}
