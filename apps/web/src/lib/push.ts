import { addPushSubscription } from './mutations'

// Llave pública VAPID (es pública por diseño; la privada vive en Supabase secrets).
export const VAPID_PUBLIC_KEY =
  'BJrdlUNzMHW4Ne9UQyRcHtC0YFTc_pGvFcSoEGTNUqcv_cH_nXPYz_ldm7VXT4xot1HItROR5Rtyv1jUjI5BVaE'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'idle'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'idle'
}

export async function subscribeToPush(userId: string | null): Promise<void> {
  if (!pushSupported()) throw new Error('Este navegador no soporta notificaciones push.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }

  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await addPushSubscription({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
  })

  // Notificación local de confirmación (no requiere el servidor)
  await reg.showNotification('Notificaciones activadas ✅', {
    body: 'Vas a recibir avisos de nuevos leads aquí, aunque el CRM esté cerrado.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })
}
