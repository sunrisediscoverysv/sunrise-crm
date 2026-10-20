import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// Vite arranca con root en apps/web, pero el .env.local del equipo vive en la
// raíz del repo (sunrise-crm/). Sin esto el cliente de Supabase lanza
// "Missing VITE_SUPABASE_URL..." al importarse y la app queda en blanco.
// Cargamos el primero que exista, sin pisar lo que ya venga del entorno.
for (const envFile of ['.env.local', '../../.env.local']) {
  const full = path.resolve(HERE, envFile)
  if (!fs.existsSync(full)) continue
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  break
}

// El CRM apunta SIEMPRE al mismo Supabase (no hay staging). Por eso:
//   - Las pruebas @readonly solo navegan y leen: seguras contra producción.
//   - Las pruebas @write crean datos reales y están apagadas salvo E2E_ALLOW_WRITES=1.
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const IS_LOCAL = BASE_URL.includes('localhost')

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.artifacts',
  fullyParallel: false, // comparten una sola cuenta y una sola BD
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/.report', open: 'never' }],
    ['json', { outputFile: 'tests/e2e/.report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    locale: 'es-SV',
    timezoneId: 'America/El_Salvador',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], storageState: 'tests/e2e/.auth/user.json' },
      dependencies: ['setup'],
      testMatch: /modules\.spec\.ts/,
    },
  ],
  ...(IS_LOCAL
    ? {
        webServer: {
          command: 'npm run dev',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
})
