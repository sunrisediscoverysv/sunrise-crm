import { describe, it, expect } from 'vitest'
import {
  WINDOW_MS,
  computeWhatsappWindow,
  lastInboundAt,
  formatWindowRemaining,
} from './whatsappWindow'

const T0 = Date.parse('2026-07-08T12:00:00.000Z')

describe('computeWhatsappWindow', () => {
  it('cierra la ventana cuando nunca hubo un mensaje entrante', () => {
    expect(computeWhatsappWindow(null, T0)).toEqual({
      open: false,
      lastInboundAt: null,
      closesAt: null,
      msRemaining: 0,
    })
  })

  it('abre la ventana justo después de un entrante', () => {
    const win = computeWhatsappWindow(new Date(T0).toISOString(), T0 + 1000)
    expect(win.open).toBe(true)
    expect(win.msRemaining).toBe(WINDOW_MS - 1000)
    expect(win.closesAt).toBe(T0 + WINDOW_MS)
  })

  it('sigue abierta un milisegundo antes de expirar', () => {
    const win = computeWhatsappWindow(new Date(T0).toISOString(), T0 + WINDOW_MS - 1)
    expect(win.open).toBe(true)
    expect(win.msRemaining).toBe(1)
  })

  it('cierra exactamente a las 24h (el límite es exclusivo)', () => {
    const win = computeWhatsappWindow(new Date(T0).toISOString(), T0 + WINDOW_MS)
    expect(win.open).toBe(false)
    expect(win.msRemaining).toBe(0)
  })

  it('no reporta tiempo negativo cuando la ventana venció hace rato', () => {
    const win = computeWhatsappWindow(new Date(T0).toISOString(), T0 + WINDOW_MS * 10)
    expect(win.open).toBe(false)
    expect(win.msRemaining).toBe(0)
  })

  it('trata una fecha inválida como ventana cerrada, no como abierta', () => {
    // Regresión: `new Date('no-es-fecha').getTime()` es NaN y `NaN > 0` es false,
    // así que la ventana cierra. Lo fijamos para que nadie "arregle" el NaN
    // introduciendo un fallback que la abra por accidente.
    const win = computeWhatsappWindow('no-es-fecha', T0)
    expect(win.open).toBe(false)
  })
})

describe('lastInboundAt', () => {
  it('devuelve null sin mensajes', () => {
    expect(lastInboundAt([])).toBeNull()
  })

  it('devuelve null si todos son salientes', () => {
    expect(lastInboundAt([
      { direction: 'outbound', created_at: 'a' },
      { direction: 'outbound', created_at: 'b' },
    ])).toBeNull()
  })

  it('toma el ÚLTIMO entrante, no el primero', () => {
    expect(lastInboundAt([
      { direction: 'inbound', created_at: 'viejo' },
      { direction: 'outbound', created_at: 'medio' },
      { direction: 'inbound', created_at: 'nuevo' },
    ])).toBe('nuevo')
  })

  it('ignora los salientes posteriores al último entrante', () => {
    expect(lastInboundAt([
      { direction: 'inbound', created_at: 'entrante' },
      { direction: 'outbound', created_at: 'saliente' },
    ])).toBe('entrante')
  })
})

describe('formatWindowRemaining', () => {
  it('muestra "menos de 1m" en cero y en negativos', () => {
    expect(formatWindowRemaining(0)).toBe('menos de 1m')
    expect(formatWindowRemaining(-5000)).toBe('menos de 1m')
    expect(formatWindowRemaining(59_999)).toBe('menos de 1m')
  })

  it('muestra solo minutos por debajo de una hora', () => {
    expect(formatWindowRemaining(60_000)).toBe('1m')
    expect(formatWindowRemaining(45 * 60_000)).toBe('45m')
  })

  it('muestra horas y minutos por encima de una hora', () => {
    expect(formatWindowRemaining(3 * 3_600_000 + 12 * 60_000)).toBe('3h 12m')
  })

  it('muestra la ventana completa como 24h 0m', () => {
    expect(formatWindowRemaining(WINDOW_MS)).toBe('24h 0m')
  })
})
