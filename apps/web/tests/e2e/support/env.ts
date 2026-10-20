import path from 'node:path'

export const AUTH_FILE = path.join(process.cwd(), 'tests/e2e/.auth/user.json')

/** Credenciales del usuario de pruebas. Sin ellas no hay suite. */
export function requireCreds(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Faltan credenciales. Exporta E2E_EMAIL y E2E_PASSWORD antes de correr la suite.\n' +
        'Ej: E2E_EMAIL=qa@sunrisediscovery.com E2E_PASSWORD=... npm run test:e2e',
    )
  }
  return { email, password }
}

/**
 * El CRM no tiene entorno de staging: local y producción comparten la misma
 * base de Supabase. Las pruebas que escriben quedan apagadas salvo que se
 * pidan explícitamente.
 */
export const ALLOW_WRITES = process.env.E2E_ALLOW_WRITES === '1'

/** Rol esperado de la cuenta de pruebas: cambia qué módulos deben ser visibles. */
export const ROLE = (process.env.E2E_ROLE ?? 'admin') as 'admin' | 'agente'

/** Marca inconfundible para reconocer y limpiar cualquier dato que dejen las pruebas. */
export function testLabel(kind: string): string {
  return `[E2E] ${kind} ${new Date().toISOString()}`
}

/** Los módulos del CRM y cómo reconocer que cargaron. */
export const MODULES = [
  { name: 'Dashboard', path: '/dashboard', heading: /👋/, nav: 'Dashboard', adminOnly: false },
  { name: 'Pipeline', path: '/pipeline', heading: /^Pipeline$/, nav: 'Pipeline', adminOnly: false },
  { name: 'Clientes', path: '/clients', heading: /^Clientes$/, nav: 'Clientes', adminOnly: false },
  { name: 'Conversaciones', path: '/inbox', heading: /^Conversaciones$/, nav: 'Conversaciones', adminOnly: false },
  { name: 'Calendario', path: '/calendar', heading: /^Calendario$/, nav: 'Calendario', adminOnly: false },
  { name: 'Propiedades', path: '/properties', heading: /^Propiedades$/, nav: 'Propiedades', adminOnly: true },
  { name: 'Operaciones', path: '/operations', heading: /^Operaciones$/, nav: 'Operaciones', adminOnly: true },
  { name: 'Configuración', path: '/settings', heading: /^Configuración$/, nav: 'Configuración', adminOnly: true },
] as const
