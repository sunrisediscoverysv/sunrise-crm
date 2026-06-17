import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

export function LoginPage() {
  const { session, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) {
      const msg = error.toLowerCase()
      if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found')) {
        setError('Correo o contraseña incorrectos.')
      } else if (msg.includes('email not confirmed')) {
        setError('Confirma tu correo antes de ingresar.')
      } else if (msg.includes('too many')) {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
      } else {
        setError('Ocurrió un error al iniciar sesión. Intenta de nuevo.')
      }
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img
            src="https://cdn.prod.website-files.com/6a08b2c521f08afd837587ad/6a08b3386c591bbe5b0d3425_Group%201171274935.svg"
            alt="Sunrise Discovery"
            className="h-10 brightness-0 invert"
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-card p-8 shadow-lg">
          <h1 className="font-display text-2xl text-brand-dark mb-1">Acceso al CRM</h1>
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

            {error && (
              <p className="text-sm text-red-500 font-sans bg-red-50 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={submitting} className="w-full mt-1">
              Ingresar
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
