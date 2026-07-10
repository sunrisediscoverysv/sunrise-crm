import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { setAppBadge } from '@/lib/appBadge'
import { useInboxConversations } from './useInboxConversations'

/**
 * Suscripción global a mensajes nuevos. Vive en el layout y no en /inbox porque
 * el contador debe moverse aunque el agente esté en el pipeline o el calendario.
 */
export function useInboxRealtime(): void {
  const queryClient = useQueryClient()
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
}

/**
 * Conversaciones con un entrante del cliente que nadie ha leído todavía; es el
 * mismo criterio del punto azul de la lista. Se cuentan conversaciones, no
 * mensajes: para el agente lo accionable es «cuántos chats debo contestar».
 *
 * Lee de la query ['inbox'] ya cacheada, así que no dispara peticiones extra.
 */
export function useUnreadCount(): number {
  const { data } = useInboxConversations()
  return (data ?? []).reduce((n, c) => n + (c.unread ? 1 : 0), 0)
}

/** Monta el realtime y mantiene el ícono de la app en sincronía. */
export function useInboxBadge(): void {
  useInboxRealtime()
  const unread = useUnreadCount()
  useEffect(() => { setAppBadge(unread) }, [unread])
}
