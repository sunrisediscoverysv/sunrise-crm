import { useState } from 'react'
import { useProfiles } from '@/hooks/useProfiles'
import { PipelineStagesManager } from './PipelineStagesManager'
import { Avatar } from '@/components/Avatar'

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

  if (profiles.length === 0) {
    return (
      <p className="text-sm text-brand-charcoal/50 font-sans py-8 text-center">
        No hay miembros del equipo registrados.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {profiles.map(profile => (
        <div
          key={profile.id}
          className="flex items-center gap-3 bg-white rounded-card border border-brand-light-gray px-4 py-3"
        >
          <Avatar name={profile.full_name} src={profile.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-dark font-sans truncate">{profile.full_name}</p>
          </div>
          <span className={`text-xs font-sans px-2.5 py-1 rounded-pill font-medium ${ROLE_COLORS[profile.role] ?? 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABEL[profile.role] ?? profile.role}
          </span>
        </div>
      ))}
      <p className="text-xs text-brand-charcoal/40 font-sans mt-1">
        Los roles se asignan directamente en la base de datos o a través del panel de Supabase.
      </p>
    </div>
  )
}

type Tab = 'pipeline' | 'team'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('pipeline')

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-brand-dark">Configuración</h1>
        <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">
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
            <h2 className="font-display text-xl text-brand-dark">Etapas del pipeline</h2>
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
            <h2 className="font-display text-xl text-brand-dark">Miembros del equipo</h2>
            <p className="text-sm text-brand-charcoal/50 font-sans mt-0.5">
              Usuarios registrados en el CRM. Los nuevos usuarios se crean desde Supabase Auth.
            </p>
          </div>
          <TeamTab />
        </section>
      )}
    </div>
  )
}
