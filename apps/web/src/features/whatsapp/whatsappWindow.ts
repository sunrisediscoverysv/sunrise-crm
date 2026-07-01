// Lógica de la "ventana de servicio" de 24h de WhatsApp: Meta solo permite enviar
// texto libre dentro de las 24h posteriores al último mensaje ENTRANTE del cliente.
// Pasado ese plazo hay que reabrir con una plantilla aprobada.

export const WINDOW_MS = 24 * 60 * 60 * 1000

export interface WhatsappWindow {
  open: boolean
  lastInboundAt: string | null
  closesAt: number | null // epoch ms
  msRemaining: number // 0 si está cerrada
}

export function computeWhatsappWindow(
  lastInboundAt: string | null,
  now: number = Date.now(),
): WhatsappWindow {
  if (!lastInboundAt) {
    return { open: false, lastInboundAt: null, closesAt: null, msRemaining: 0 }
  }
  const closesAt = new Date(lastInboundAt).getTime() + WINDOW_MS
  const msRemaining = Math.max(0, closesAt - now)
  return { open: msRemaining > 0, lastInboundAt, closesAt, msRemaining }
}

// Fecha del último mensaje entrante de una lista ordenada ascendente por created_at.
export function lastInboundAt(
  messages: { direction: string; created_at: string }[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'inbound') return messages[i].created_at
  }
  return null
}

// "3h 12m" · "45m" · "menos de 1m"
export function formatWindowRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  if (totalMin <= 0) return 'menos de 1m'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
