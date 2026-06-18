import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { getPushState, subscribeToPush, syncExistingSubscription, type PushState } from '@/lib/push'

export function NotificationsButton() {
  const { user } = useAuth()
  const [state, setState] = useState<PushState | 'loading' | 'working'>('loading')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPushState()
      .then(async st => {
        if (cancelled) return
        setState(st)
        // Si el navegador ya está suscrito, reasegurar el guardado en la DB
        if (st === 'subscribed') {
          try {
            await syncExistingSubscription(user?.id ?? null)
          } catch (e) {
            setErrMsg(e instanceof Error ? e.message : String(e))
          }
        }
      })
      .catch(() => setState('unsupported'))
    return () => { cancelled = true }
  }, [user?.id])

  async function activate() {
    setState('working')
    setErrMsg(null)
    try {
      await subscribeToPush(user?.id ?? null)
      setState('subscribed')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setState(Notification.permission === 'denied' ? 'denied' : 'idle')
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  const bell = (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )

  return (
    <div className="mb-2">
      {state === 'subscribed' ? (
        <div className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] text-white/45 text-xs font-sans">
          {bell} Notificaciones activadas
        </div>
      ) : state === 'denied' ? (
        <p className="text-[11px] text-white/35 font-sans px-1 leading-snug">
          Notificaciones bloqueadas. Activalas desde los ajustes del navegador para este sitio.
        </p>
      ) : (
        <button
          onClick={activate}
          disabled={state === 'working'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] text-white/80 text-sm font-semibold font-sans hover:bg-white/[0.12] transition-colors disabled:opacity-60"
        >
          {state === 'working'
            ? <span className="h-3.5 w-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            : bell}
          Activar notificaciones
        </button>
      )}
      {errMsg && (
        <p className="text-[10px] text-red-300/80 font-sans mt-1 px-1 leading-snug break-words">
          Error al guardar: {errMsg}
        </p>
      )}
    </div>
  )
}
