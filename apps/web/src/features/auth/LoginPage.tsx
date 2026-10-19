import { useState, useEffect, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

// Anti-fuerza bruta (capa de cliente): tras MAX_ATTEMPTS intentos fallidos,
// el formulario se bloquea con un cooldown que crece exponencialmente.
// Se persiste en localStorage para que recargar la página no lo reinicie.
// La protección real (lado servidor) la da el rate-limit y el CAPTCHA de Supabase Auth.
const MAX_ATTEMPTS = 5
const STORAGE_ATTEMPTS = 'sd_login_attempts'
const STORAGE_LOCK = 'sd_login_locked_until'

function lockMsFor(attempts: number): number {
  // desde el 5º fallo: 30s, 1m, 2m, 4m, 8m, … (tope 15m)
  const over = Math.max(0, attempts - MAX_ATTEMPTS)
  return Math.min(30 * 2 ** over, 900) * 1000
}

function readNumber(key: string): number {
  const v = Number(localStorage.getItem(key) ?? 0)
  return Number.isFinite(v) ? v : 0
}

export function LoginPage() {
  const { session, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number>(() => readNumber(STORAGE_LOCK))
  const [now, setNow] = useState(() => Date.now())

  const locked = lockedUntil > now
  const remainingSec = locked ? Math.ceil((lockedUntil - now) / 1000) : 0

  // Mientras está bloqueado, refrescamos el contador cada segundo.
  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [locked])

  if (!loading && session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (lockedUntil > Date.now()) return // bloqueado: no intentar
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) {
      const attempts = readNumber(STORAGE_ATTEMPTS) + 1
      localStorage.setItem(STORAGE_ATTEMPTS, String(attempts))
      if (attempts >= MAX_ATTEMPTS) {
        const until = Date.now() + lockMsFor(attempts)
        localStorage.setItem(STORAGE_LOCK, String(until))
        setLockedUntil(until)
        setNow(Date.now())
      }
      const msg = error.toLowerCase()
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found')) {
        const left = MAX_ATTEMPTS - attempts
        setError(left > 0 && left <= 2
          ? `Correo o contraseña incorrectos. Te quedan ${left} intento${left === 1 ? '' : 's'}.`
          : 'Correo o contraseña incorrectos.')
      } else if (msg.includes('email not confirmed')) {
        setError('Confirma tu correo antes de ingresar.')
      } else if (msg.includes('too many') || msg.includes('rate')) {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
      } else {
        setError('Ocurrió un error al iniciar sesión. Intenta de nuevo.')
      }
    } else {
      // Éxito: limpiar contadores de bloqueo.
      localStorage.removeItem(STORAGE_ATTEMPTS)
      localStorage.removeItem(STORAGE_LOCK)
      setLockedUntil(0)
    }
    setSubmitting(false)
  }

  const lockLabel = remainingSec >= 60
    ? `${Math.floor(remainingSec / 60)} min ${String(remainingSec % 60).padStart(2, '0')} s`
    : `${remainingSec} s`

  return (
    <div className="min-h-screen bg-[#0f3b49] bg-login flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-9">
          <img
            src="https://cdn.prod.website-files.com/6a08b2c521f08afd837587ad/6a08b3386c591bbe5b0d3425_Group%201171274935.svg"
            alt="Sunrise Discovery"
            className="h-10 brightness-0 invert"
          />
          <div className="flex items-center gap-1.5 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal/70" />
            <span className="text-white/40 text-[10px] font-sans tracking-[0.3em] uppercase">CRM</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-card p-8 shadow-2xl ring-1 ring-white/10">
          <h1 className="font-display text-3xl text-brand-dark mb-1.5">Acceso al CRM</h1>
          <p className="text-sm text-brand-charcoal/60 font-sans mb-7">
            Ingresa con tu cuenta del equipo
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="agente@sunrisediscovery.com"
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1.5 bottom-[3px] w-9 h-9 flex items-center justify-center rounded-md text-brand-charcoal/45 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {locked ? (
              <p className="text-sm text-amber-700 font-sans bg-amber-50 rounded-lg px-4 py-2.5">
                Demasiados intentos fallidos. Por seguridad, vuelve a intentar en <span className="font-semibold tabular-nums">{lockLabel}</span>.
              </p>
            ) : error && (
              <p className="text-sm text-red-500 font-sans bg-red-50 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={submitting} disabled={locked} className="w-full mt-1">
              {locked ? `Bloqueado · ${lockLabel}` : 'Ingresar'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/40 font-sans mt-6">
          © {new Date().getFullYear()} Sunrise Discovery El Salvador
        </p>
      </div>
    </div>
  )
}
