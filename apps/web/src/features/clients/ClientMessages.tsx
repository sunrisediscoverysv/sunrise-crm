import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Message } from '@/types/database'

interface ClientMessagesProps {
  clientId: string
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

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
}

export function ClientMessages({ clientId }: ClientMessagesProps) {
  const { data: messages = [], isLoading } = useMessages(clientId)

  return (
    <section>
      <h3 className="font-sans font-semibold text-lg text-brand-dark mb-4">Historial de mensajes</h3>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-brand-light-gray rounded-card animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-sm text-brand-charcoal/40 font-sans py-4 text-center">
          Sin mensajes registrados.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map(msg => {
            const isInbound = msg.direction === 'inbound'
            return (
              <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={[
                    'max-w-[75%] rounded-card px-3.5 py-2.5',
                    isInbound
                      ? 'bg-white border border-brand-light-gray'
                      : 'bg-brand-dark text-white',
                  ].join(' ')}
                >
                  {msg.content && (
                    <p className={`text-sm font-serif leading-relaxed ${isInbound ? 'text-brand-charcoal' : 'text-white'}`}>
                      {msg.content}
                    </p>
                  )}
                  <div className={`flex items-center gap-2 mt-1 ${isInbound ? '' : 'justify-end'}`}>
                    <span className={`text-xs font-sans ${isInbound ? 'text-brand-charcoal/40' : 'text-white/50'}`}>
                      {channelLabel[msg.channel] ?? msg.channel}
                      {' · '}
                      {format(new Date(msg.created_at), 'dd MMM · HH:mm', { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
