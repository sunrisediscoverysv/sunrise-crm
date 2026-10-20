import { test, expect } from '@playwright/test'
import { MODULES, ROLE } from './support/env'

/**
 * Control de acceso: sesión, guardas de ruta y bloqueo por rol.
 * Ver ProtectedRoute — sin sesión va a /login; rol bloqueado va a /dashboard.
 */

test.describe('sin sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const modulo of MODULES) {
    test(`@readonly ${modulo.path} redirige a /login`, async ({ page }) => {
      await page.goto(modulo.path)
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByRole('heading', { name: 'Acceso al CRM' })).toBeVisible()
    })
  }

  test('@readonly credenciales inválidas muestran error y no crean sesión', async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => {
      localStorage.removeItem('sd_login_attempts')
      localStorage.removeItem('sd_login_locked_until')
    })
    await page.reload()

    await page.getByLabel('Correo electrónico').fill('no-existe@sunrisediscovery.com')
    await page.getByLabel('Contraseña').fill('contraseña-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByText(/Correo o contraseña incorrectos/)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('con sesión', () => {
  test('@readonly /login redirige al dashboard si ya hay sesión', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('@readonly la raíz redirige al dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('@readonly la sesión sobrevive a una recarga', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/\/clients/)
    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible()
  })

  test('@readonly los módulos restringidos respetan el rol', async ({ page }) => {
    for (const modulo of MODULES.filter(m => m.adminOnly)) {
      await page.goto(modulo.path)
      if (ROLE === 'admin') {
        await expect(page, `admin debe ver ${modulo.name}`).toHaveURL(new RegExp(`${modulo.path}$`))
      } else {
        await expect(page, `${ROLE} no debe ver ${modulo.name}`).toHaveURL(/\/dashboard/)
      }
    }
  })

  test('@readonly cerrar sesión devuelve a /login y bloquea el regreso', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'El botón de salir vive en el sidebar')
    await page.goto('/dashboard')

    await page.getByRole('button', { name: /cerrar sesión|salir/i }).click()
    await expect(page).toHaveURL(/\/login/)

    // Volver atrás no debe devolver la sesión.
    await page.goto('/clients')
    await expect(page).toHaveURL(/\/login/)
  })
})
