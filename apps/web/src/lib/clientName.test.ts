import { describe, it, expect } from 'vitest'
import { needsName } from './clientName'

describe('needsName', () => {
  it('necesita nombre cuando full_name falta', () => {
    expect(needsName({})).toBe(true)
    expect(needsName({ full_name: null })).toBe(true)
    expect(needsName({ full_name: '' })).toBe(true)
  })

  it('necesita nombre cuando full_name es solo espacios', () => {
    expect(needsName({ full_name: '   ' })).toBe(true)
  })

  it('necesita nombre cuando el nombre es el teléfono (placeholder del webhook)', () => {
    expect(needsName({ full_name: '+50371234567', phone: '+50371234567' })).toBe(true)
  })

  it('necesita nombre cuando el nombre es el channel_user_id', () => {
    expect(needsName({ full_name: 'wa_9981', channel_user_id: 'wa_9981' })).toBe(true)
  })

  it('compara el placeholder ya recortado', () => {
    expect(needsName({ full_name: '  +50371234567  ', phone: '+50371234567' })).toBe(true)
  })

  it('NO necesita nombre cuando un agente puso un nombre real', () => {
    expect(needsName({ full_name: 'María López', phone: '+50371234567' })).toBe(false)
  })

  it('NO necesita nombre aunque el teléfono sea null y el nombre parezca raro', () => {
    expect(needsName({ full_name: 'wa_9981', phone: null, channel_user_id: null })).toBe(false)
  })

  it('no confunde un nombre real con un channel_user_id distinto', () => {
    expect(needsName({ full_name: 'Ana', channel_user_id: 'wa_1', phone: '+503' })).toBe(false)
  })
})
