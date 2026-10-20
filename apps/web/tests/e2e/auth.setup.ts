import { test as setup, expect } from '@playwright/test'
import { AUTH_FILE, requireCreds } from './support/env'

// Inicia sesión una sola vez y guarda el storageState (incluye el JWT de
// Supabase en localStorage). El resto de specs arrancan ya autenticadas.
setup('autenticar', async ({ page }) => {
  const { email, password } = requireCreds()

  await page.goto('/login')

  // El login tiene bloqueo anti-fuerza-bruta persistido en localStorage
  // (5 fallos → cooldown exponencial). Lo limpiamos para que un run previo
  // fallido no bloquee este.
  await page.evaluate(() => {
    localStorage.removeItem('sd_login_attempts')
    localStorage.removeItem('sd_login_locked_until')
  })
  await page.reload()

  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  // Éxito = redirección a /dashboard. Si las credenciales fallan, el mensaje
  // de error de la app es más útil que un timeout genérico.
  const errorBanner = page.locator('p.text-red-500, p.text-amber-700')
  await Promise.race([
    page.waitForURL('**/dashboard', { timeout: 20_000 }),
    errorBanner
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(async () => {
        throw new Error(`Login rechazado por la app: "${await errorBanner.innerText()}"`)
      }),
  ])

  await expect(page).toHaveURL(/\/dashboard/)
  await page.context().storageState({ path: AUTH_FILE })
})
