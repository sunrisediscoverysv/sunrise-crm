import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useProfiles } from '@/hooks/useProfiles'
import { createUser, updateProfileRole, type NewUserRole } from '@/lib/mutations'
import { PipelineStagesManager } from './PipelineStagesManager'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import type { Profile } from '@/types/database'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  agente: 'Agente',
  visor: 'Visor',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-brand-teal/10 text-brand-teal',
  agente: 'bg-blue-50 text-blue-600',
  visor: 'bg-gray-100 text-brand-charcoal/60',
}

const ROLES: NewUserRole[] = ['admin', 'agente', 'visor']

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}

function NewUserForm() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(randomPassword())
  const [role, setRole] = useState<NewUserRole>('agente')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  const mut = useMutation({
    mutationFn: () => createUser({ email: email.trim(), password, full_name: fullName.trim(), role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setCreated({ email: email.trim(), password })
      setFullName(''); setEmail(''); setRole('agente')
    },
    onError: (e: Error) => setError(e.message),
  })

  function submit() {
    setError(null)
    if (!fullName.trim()) return setError('El nombre es obligatorio')
    if (!email.includes('@')) return setError('Email inválido')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    mut.mutate()
  }

  if (created) {
    return (
      <div className="bg-white rounded-card border border-emerald-300 p-4 flex flex-col gap-2 mb-4">
        <p className="text-sm font-medium text-emerald-700 font-sans">✓ Usuario creado</p>
        <p className="text-sm text-brand-dark font-sans">
          Comparte estas credenciales con <strong>{created.email}</strong>:
        </p>
        <div className="bg-brand-light-gray/40 rounded-button p-3 font-mono text-sm text-brand-dark break-all select-all">
          <div>Email: {created.email}</div>
          <div>Contraseña: {created.password}</div>
        </div>
        <p className="text-xs text-brand-charcoal/50 font-sans">El usuario ya puede iniciar sesión y cambiar su contraseña.</p>
        <div className="flex gap-2 mt-1">
          <Button size="sm" onClick={() => { setCreated(null); setPassword(randomPassword()); setOpen(true) }}>Crear otro</Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreated(null); setPassword(randomPassword()); setOpen(false) }}>Cerrar</Button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-card border-2 border-dashed border-brand-light-gray text-brand-charcoal/50 hover:border-brand-teal hover:text-brand-teal transition-colors font-sans text-sm mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nuevo usuario
      </button>
    )
  }

  const inputCls = 'w-full px-3 py-2 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal'

  return (
    <div className="bg-white rounded-card border border-brand-teal/40 p-4 flex flex-col gap-3 mb-4">
      <p className="text-sm font-medium text-brand-dark font-sans">Nuevo usuario</p>
      <input className={inputCls} placeholder="Nombre completo" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus />
      <input className={inputCls} placeholder="correo@ejemplo.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <div className="flex gap-2">
        <input className={`${inputCls} flex-1 font-mono`} value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" onClick={() => setPassword(randomPassword())} className="px-3 py-2 text-xs font-sans text-brand-teal border border-brand-light-gray rounded-button hover:bg-brand-teal/10 transition-colors whitespace-nowrap">
          Generar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-brand-charcoal/50 font-sans">Rol:</span>
        <select className={inputCls} value={role} onChange={e => setRole(e.target.value as NewUserRole)} style={{ width: 'auto' }}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" loading={mut.isPending} onClick={submit}>Crear usuario</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null) }}>Cancelar</Button>
      </div>
    </div>
  )
}

function RoleSelect({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const mut = useMutation({
    mutationFn: (role: NewUserRole) => updateProfileRole(profile.id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })
  return (
    <select
      value={profile.role}
      disabled={mut.isPending}
      onChange={e => mut.mutate(e.target.value as NewUserRole)}
      className={`text-xs font-sans px-2.5 py-1 rounded-pill font-medium border-0 cursor-pointer disabled:opacity-50 ${ROLE_COLORS[profile.role] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  )
}

function TeamTab() {
  const { data: profiles = [], isLoading } = useProfiles()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-brand-light-gray rounded-card animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <NewUserForm />
      {isLoading ? (
        [...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-brand-light-gray rounded-card animate-pulse" />
        ))
      ) : profiles.length === 0 ? (
        <p className="text-sm text-brand-charcoal/50 font-sans py-8 text-center">
          No hay miembros del equipo registrados.
        </p>
      ) : (
        profiles.map(profile => (
          <div
            key={profile.id}
            className="flex items-center gap-3 bg-white rounded-card shadow-card px-4 py-3"
          >
            <Avatar name={profile.full_name} src={profile.avatar_url} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-dark font-sans truncate">{profile.full_name}</p>
            </div>
            <RoleSelect profile={profile} />
          </div>
        ))
      )}
      <p className="text-xs text-brand-charcoal/40 font-sans mt-1">
        Al crear un usuario se genera su cuenta y puede iniciar sesión de inmediato con las credenciales mostradas.
      </p>
    </div>
  )
}

type Tab = 'pipeline' | 'team'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('pipeline')

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Configuración</h1>
        <p className="text-brand-charcoal/60 font-sans mt-1.5 text-sm">
          Solo los administradores pueden acceder a esta sección.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-brand-light-gray/50 rounded-button p-1 w-fit">
        {(['pipeline', 'team'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-1.5 text-sm font-medium font-sans rounded-button transition-colors',
              tab === t
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-brand-charcoal/60 hover:text-brand-dark',
            ].join(' ')}
          >
            {t === 'pipeline' ? 'Etapas del pipeline' : 'Equipo'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'pipeline' && (
        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl text-brand-dark">Etapas del pipeline</h2>
            <p className="text-sm text-brand-charcoal/50 font-sans mt-0.5">
              Define las etapas del embudo de ventas. El orden aquí es el orden en el Kanban.
            </p>
          </div>
          <PipelineStagesManager />
        </section>
      )}

      {tab === 'team' && (
        <section>
          <div className="mb-4">
            <h2 className="font-display text-2xl text-brand-dark">Miembros del equipo</h2>
            <p className="text-sm text-brand-charcoal/50 font-sans mt-0.5">
              Usuarios registrados en el CRM. Los nuevos usuarios se crean desde Supabase Auth.
            </p>
          </div>
          <TeamTab />
        </section>
      )}
    </div>
    </div>
  )
}
