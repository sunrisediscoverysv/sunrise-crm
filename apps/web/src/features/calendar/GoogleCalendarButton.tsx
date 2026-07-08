import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGoogleConnection, connectGoogleCalendar, disconnectGoogleCalendar } from '@/hooks/useGoogleCalendar'

const GIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
)

export function GoogleCalendarButton() {
  const queryClient = useQueryClient()
  const { data: conn, isLoading } = useGoogleConnection()
  const [menuOpen, setMenuOpen] = useState(false)

  const connectMut = useMutation({ mutationFn: connectGoogleCalendar })
  const disconnectMut = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['google-connection'] }); setMenuOpen(false) },
  })

  if (isLoading) return null

  if (!conn?.connected) {
    return (
      <button
        onClick={() => connectMut.mutate()}
        disabled={connectMut.isPending}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-brand-light-gray text-brand-dark text-sm font-medium font-sans rounded-button hover:border-brand-teal/50 hover:bg-brand-teal/[0.03] transition-colors disabled:opacity-60"
      >
        <GIcon />
        {connectMut.isPending ? 'Conectando…' : 'Conectar Google Calendar'}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-200 text-brand-dark text-sm font-medium font-sans rounded-button hover:bg-emerald-50/50 transition-colors"
      >
        <GIcon />
        <span className="hidden sm:inline text-brand-charcoal/70">{conn.email ?? 'Conectado'}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-card-hover border border-brand-light-gray py-1 z-20">
          <div className="px-4 py-2 text-xs text-brand-charcoal/50 font-sans border-b border-brand-light-gray">
            Las nuevas citas se agregan a este Google Calendar.
          </div>
          <button
            onClick={() => disconnectMut.mutate()}
            disabled={disconnectMut.isPending}
            className="w-full text-left px-4 py-2 text-sm font-sans text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {disconnectMut.isPending ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      )}
    </div>
  )
}
