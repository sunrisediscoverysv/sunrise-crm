import { test, expect, type Page } from '@playwright/test'
import { MODULES, ROLE } from './support/env'

/**
 * Smoke @readonly de cada módulo: navega, comprueba que la vista cargó de
 * verdad (no solo el cascarón), y vigila la consola y las respuestas de la API.
 * No escribe nada, así que es seguro correrlo contra producción.
 */

type Watcher = { errors: string[]; badResponses: string[] }

/** Engancha los listeners ANTES de navegar; si no, se pierden los primeros eventos. */
function watch(page: Page): Watcher {
  const w: Watcher = { errors: [], badResponses: [] }

  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Ruido conocido que no indica fallo de la app.
    if (/favicon|manifest\.json|Download the React DevTools/i.test(text)) return
    w.errors.push(text)
  })
  page.on('pageerror', err => w.errors.push(`pageerror: ${err.message}`))
  page.on('response', resp => {
    const url = resp.url()
    if (!url.includes('supabase.co')) return
    // 406 = PostgREST con .single() y cero filas; la app lo maneja.
    if (resp.status() >= 400 && resp.status() !== 406) {
      w.badResponses.push(`${resp.status()} ${resp.request().method()} ${url.split('?')[0]}`)
    }
  })
  return w
}

function assertClean(w: Watcher, modulo: string) {
  expect(w.errors, `Errores de consola en ${modulo}`).toEqual([])
  expect(w.badResponses, `Respuestas fallidas de Supabase en ${modulo}`).toEqual([])
}

const visibles = MODULES.filter(m => ROLE === 'admin' || !m.adminOnly)

for (const modulo of visibles) {
  test(`@readonly ${modulo.name} carga sin errores`, async ({ page }, testInfo) => {
    const w = watch(page)

    await page.goto(modulo.path)
    await expect(page.getByRole('heading', { name: modulo.heading, level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')

    await testInfo.attach(`${modulo.name}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    assertClean(w, modulo.name)
  })
}

test('@readonly la navegación lateral llega a todos los módulos', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'El sidebar está fuera de pantalla en móvil')
  const w = watch(page)
  await page.goto('/dashboard')

  for (const modulo of visibles) {
    await page.getByRole('link', { name: modulo.nav, exact: false }).first().click()
    await expect(page).toHaveURL(new RegExp(`${modulo.path}$`))
    await expect(page.getByRole('heading', { name: modulo.heading, level: 1 })).toBeVisible()
  }
  assertClean(w, 'navegación')
})

test('@readonly Dashboard: las tarjetas de métricas abren su detalle', async ({ page }) => {
  const w = watch(page)
  await page.goto('/dashboard')

  const statLinks = page.locator('a[href^="/stats/"]')
  await expect(statLinks.first()).toBeVisible()
  expect(await statLinks.count(), 'el dashboard debe mostrar tarjetas de métricas').toBeGreaterThan(0)

  await statLinks.first().click()
  await expect(page).toHaveURL(/\/stats\//)
  await page.waitForLoadState('networkidle')
  assertClean(w, 'Dashboard → detalle de métrica')
})

test('@readonly Pipeline: rinde las columnas del kanban', async ({ page }) => {
  const w = watch(page)
  await page.goto('/pipeline')
  await expect(page.getByRole('heading', { name: 'Pipeline', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  // Cada columna lleva su nombre de etapa en un h2 en mayúsculas.
  const columnas = page.locator('h2.uppercase')
  expect(await columnas.count(), 'el pipeline debe tener etapas configuradas').toBeGreaterThan(0)
  assertClean(w, 'Pipeline')
})

test('@readonly Clientes: el detalle de un cliente abre', async ({ page }) => {
  const w = watch(page)
  await page.goto('/clients')
  await page.waitForLoadState('networkidle')

  const filas = page.locator('tbody tr')
  const total = await filas.count()
  test.skip(total === 0, 'No hay clientes en la base para abrir un detalle')

  await filas.first().click()
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}/)
  await page.waitForLoadState('networkidle')
  assertClean(w, 'Clientes → detalle')
})

test('@readonly Conversaciones: lista y buscador responden', async ({ page }) => {
  const w = watch(page)
  await page.goto('/inbox')
  await expect(page.getByRole('heading', { name: 'Conversaciones', level: 1 })).toBeVisible()

  const buscador = page.getByPlaceholder('Buscar por nombre o teléfono…')
  await expect(buscador).toBeVisible()
  await page.waitForLoadState('networkidle')

  await buscador.fill('zzz-no-existe-zzz')
  await expect(page.locator('tbody tr, [data-conv-item]')).toHaveCount(0, { timeout: 5_000 })
  await buscador.clear()
  assertClean(w, 'Conversaciones')
})

test('@readonly Calendario: navega entre meses', async ({ page }) => {
  const w = watch(page)
  await page.goto('/calendar')
  await expect(page.getByRole('heading', { name: 'Calendario', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  const titulo = page.locator('h2.capitalize').first()
  const mesInicial = await titulo.innerText()

  // Los controles de mes son los botones hermanos del título.
  const botones = page.locator('h2.capitalize').locator('xpath=../button')
  if ((await botones.count()) >= 2) {
    await botones.last().click()
    await expect(titulo).not.toHaveText(mesInicial)
  }
  assertClean(w, 'Calendario')
})

test('@readonly Operaciones: las tres pestañas cargan', async ({ page }) => {
  test.skip(ROLE !== 'admin', 'Operaciones está bloqueado para el rol agente')
  const w = watch(page)
  await page.goto('/operations')
  await expect(page.getByRole('heading', { name: 'Operaciones', level: 1 })).toBeVisible()

  for (const pestana of ['Ventas', 'Tareas', 'Pagos']) {
    await page.getByRole('button', { name: pestana, exact: true }).click()
    await page.waitForLoadState('networkidle')
  }
  assertClean(w, 'Operaciones')
})

test('@readonly Propiedades: listado e insights', async ({ page }) => {
  test.skip(ROLE !== 'admin', 'Propiedades está bloqueado para el rol agente')
  const w = watch(page)

  await page.goto('/properties')
  await expect(page.getByRole('heading', { name: 'Propiedades', level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')

  await page.goto('/properties/insights')
  await page.waitForLoadState('networkidle')
  assertClean(w, 'Propiedades')
})

test('@readonly Configuración: etapas del pipeline y equipo', async ({ page }) => {
  test.skip(ROLE !== 'admin', 'Configuración requiere rol admin')
  const w = watch(page)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Etapas del pipeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Miembros del equipo' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  assertClean(w, 'Configuración')
})
