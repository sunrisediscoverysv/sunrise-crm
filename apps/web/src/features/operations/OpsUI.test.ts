import { describe, it, expect } from 'vitest'
import { parseAmount } from './OpsUI'

describe('parseAmount', () => {
  it('convierte montos válidos', () => {
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('1500')).toBe(1500)
    expect(parseAmount('1500.75')).toBe(1500.75)
    expect(parseAmount('.5')).toBe(0.5)
    expect(parseAmount('12.')).toBe(12)
  })

  it('devuelve null en vacío o solo espacios (campo sin llenar)', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
  })

  it('devuelve null en basura no numérica', () => {
    expect(parseAmount('.')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
  })

  it('distingue 0 de "sin valor": 0 es un monto válido, "" no', () => {
    // Importante para la comisión, que es opcional: 0 debe guardarse como 0,
    // y vacío debe guardarse como NULL. Un `if (!parseAmount(v))` los mezclaría.
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('0')).not.toBeNull()
  })

  it('rechaza Infinity y notación que Number() aceptaría', () => {
    expect(parseAmount('Infinity')).toBeNull()
    expect(parseAmount('-Infinity')).toBeNull()
  })

  it('ignora espacios alrededor de un número válido', () => {
    expect(parseAmount(' 250 ')).toBe(250)
  })
})
