import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Botón "Instalar app" que aparece solo cuando el navegador permite instalar la PWA
 * (Chromium). Captura el evento beforeinstallprompt y dispara el instalador nativo.
 */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Ya corre como app instalada, o el navegador aún no ofrece instalar
  const standalone =
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  if (standalone || !deferred) return null

  async function handleInstall() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return (
    <button
      onClick={handleInstall}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-xl bg-brand-teal/15 text-white text-sm font-semibold font-sans hover:bg-brand-teal/25 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
      </svg>
      Instalar app
    </button>
  )
}
