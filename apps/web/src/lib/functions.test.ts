import { describe, it, expect } from 'vitest'
import { functionsErrorMessage } from './functions'

/** Imita el FunctionsHttpError de supabase-js: mensaje genérico + Response en `context`. */
function httpError(body: unknown, message = 'Edge Function returned a non-2xx status code') {
  const err = new Error(message) as Error & { context: Response }
  err.context = new Response(JSON.stringify(body), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  })
  return err
}

describe('functionsErrorMessage', () => {
  it('extrae el campo `error` del cuerpo JSON de la Edge Function', async () => {
    const err = httpError({ error: 'El correo ya está registrado.' })
    await expect(functionsErrorMessage(err)).resolves.toBe('El correo ya está registrado.')
  })

  it('no consume el body: se puede volver a leer después (usa clone)', async () => {
    const err = httpError({ error: 'boom' })
    await functionsErrorMessage(err)
    // Si el helper hubiera leído `context` directamente, este segundo read lanzaría.
    await expect(err.context.json()).resolves.toEqual({ error: 'boom' })
  })

  it('cae al message del Error cuando el cuerpo no es JSON', async () => {
    const err = new Error('network down') as Error & { context: Response }
    err.context = new Response('<html>502</html>', { status: 502 })
    await expect(functionsErrorMessage(err)).resolves.toBe('network down')
  })

  it('cae al message cuando el JSON no trae campo `error`', async () => {
    const err = httpError({ detail: 'otra forma' }, 'fallo generico')
    await expect(functionsErrorMessage(err)).resolves.toBe('fallo generico')
  })

  it('usa el fallback cuando no hay context ni message', async () => {
    await expect(functionsErrorMessage(null, 'Ocurrió un error.')).resolves.toBe('Ocurrió un error.')
    await expect(functionsErrorMessage(undefined, 'Ocurrió un error.')).resolves.toBe('Ocurrió un error.')
  })

  it('convierte a string un `error` que no sea string', async () => {
    const err = httpError({ error: 42 })
    await expect(functionsErrorMessage(err)).resolves.toBe('42')
  })
})
