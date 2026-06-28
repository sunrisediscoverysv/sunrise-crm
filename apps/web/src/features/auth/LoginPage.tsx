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
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

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
