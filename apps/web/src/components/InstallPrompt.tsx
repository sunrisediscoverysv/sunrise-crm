import { useEffect, useState } from 'react'

const DISMISS_KEY = 'pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Popup de instalación: en Chrome/Edge dispara el instalador nativo; en iOS Safari
 * (que no lo permite por código) muestra las instrucciones de "Agregar a inicio".
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<'none' | 'chromium' | 'ios'>('none')

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    const nav = navigator as Navigator & { standalone?: boolean }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
    if (standalone) return

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setTimeout(() => setMode('chromium'), 2500)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    let iosTimer: ReturnType<typeof setTimeout> | undefined
    if (isIOS && isSafari) {
      iosTimer = setTimeout(() => setMode('ios'), 2800)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setMode('none')
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setMode('none')
  }

  if (mode === 'none') return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto max-w-md mx-auto bg-white rounded-card shadow-card-hover ring-1 ring-black/5 p-4 flex items-start gap-3 animate-[slideUp_0.3s_ease-out]">
        <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-xl flex-shrink-0 shadow-sm" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base text-brand-dark leading-tight">Instalá Sunrise CRM</p>
          {mode === 'chromium' ? (
            <p className="text-xs text-brand-charcoal/55 font-sans mt-0.5">
              Accedé más rápido y recibí avisos de nuevos leads en tu dispositivo.
            </p>
          ) : (
            <p className="text-xs text-brand-charcoal/55 font-sans mt-1 leading-relaxed">
              Tocá el botón <span className="font-semibold">Compartir</span> ⬆️ y elegí{' '}
              <span className="font-semibold">«Agregar a inicio»</span>.
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            {mode === 'chromium' && (
              <button
                onClick={install}
                className="px-4 py-1.5 bg-brand-teal text-white text-xs font-semibold font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep transition-colors"
              >
                Instalar app
              </button>
            )}
            <button
              onClick={dismiss}
              className="px-3 py-1.5 text-brand-charcoal/55 text-xs font-semibold font-sans rounded-button hover:bg-brand-light-gray/60 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-brand-charcoal/30 hover:text-brand-charcoal/60 p-1 -mt-1 -mr-1" aria-label="Cerrar">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
