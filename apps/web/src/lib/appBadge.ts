// Conteo sobre el ícono de la app instalada (Badging API), como el globito de
// WhatsApp. Soporte real: PWA instalada en iOS 16.4+ (exige permiso de
// notificaciones) y escritorio Chrome/Edge. Chrome para Android NO la implementa
// y el launcher ignora el conteo; ahí el número solo se ve dentro de la app.
//
// Nunca lanza: si la API no existe, o el usuario no dio permiso, no hace nada.

type BadgingNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

export function supportsAppBadge(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator
}

export function setAppBadge(count: number): void {
  const nav = navigator as BadgingNavigator
  if (!nav.setAppBadge) return
  // Safari rechaza la promesa si no hay permiso de notificaciones concedido.
  const done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.()
  void done?.catch(() => { /* sin permiso o sin soporte: se ignora */ })
}
