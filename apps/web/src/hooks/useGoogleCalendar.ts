import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface GoogleConnection {
  connected: boolean
  email: string | null
}

/** Estado de conexión de Google Calendar del usuario actual. */
export function useGoogleConnection() {
  return useQuery({
    queryKey: ['google-connection'],
    queryFn: async (): Promise<GoogleConnection> => {
      const { data } = await supabase
        .from('google_calendar_tokens')
        .select('google_email')
        .maybeSingle()
      const row = data as { google_email: string | null } | null
      return { connected: !!row, email: row?.google_email ?? null }
    },
    staleTime: 1000 * 30,
  })
}

/** Pide la URL de consentimiento y redirige a Google. */
export async function connectGoogleCalendar(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('google-oauth', { body: { action: 'auth-url' } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  if (data?.url) window.location.href = data.url
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-oauth', { body: { action: 'disconnect' } })
  if (error) throw new Error(error.message)
}

/**
 * Sincroniza una cita con Google Calendar (crea o actualiza el evento).
 * Silencioso: si el usuario no está conectado o algo falla, no rompe el flujo
 * de guardado de la cita en el sistema.
 */
export async function syncAppointmentToGoogle(appointmentId: string): Promise<void> {
  try {
    await supabase.functions.invoke('google-calendar-sync', { body: { appointmentId } })
  } catch { /* la cita ya quedó guardada en el sistema; el sync es best-effort */ }
}

export async function deleteAppointmentFromGoogle(googleEventId: string | null): Promise<void> {
  if (!googleEventId) return
  try {
    await supabase.functions.invoke('google-calendar-sync', { body: { action: 'delete', googleEventId } })
  } catch { /* best-effort */ }
}
