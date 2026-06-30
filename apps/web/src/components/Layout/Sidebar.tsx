import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/Button'
import { GlobalSearch } from '@/components/GlobalSearch'
import { InstallButton } from '@/components/InstallButton'
import { NotificationsButton } from '@/components/NotificationsButton'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/pipeline',
    label: 'Pipeline',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    to: '/clients',
    label: 'Clientes',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendario',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/properties',
    label: 'Propiedades',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
      </svg>
    ),
  },
]

const adminNavItems = [
  {
    to: '/settings',
    label: 'Configuración',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()

  const navLink = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
          isActive
            ? 'bg-brand-teal text-white shadow-[0_6px_16px_-4px_rgba(3,165,175,0.6)]'
            : 'text-white/55 hover:text-white hover:bg-white/[0.07]',
        ].join(' ')
      }
    >
      {icon}
      {label}
    </NavLink>
  )

  return (
    <aside
      className={[
        'flex-shrink-0 flex flex-col h-full w-64 bg-brand-dark',
        // Mobile: slide in/out from left as fixed overlay
        'fixed top-0 left-0 z-30 transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: static, always visible
        'lg:relative lg:translate-x-0 lg:z-auto',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
        <div>
          <img
            src="https://cdn.prod.website-files.com/6a08b2c521f08afd837587ad/6a08b3386c591bbe5b0d3425_Group%201171274935.svg"
            alt="Sunrise Discovery"
            className="h-8 brightness-0 invert"
          />
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal/60" />
            <p className="text-white/30 text-[10px] font-sans tracking-[0.2em] uppercase">CRM</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Global search */}
      <div className="px-3 py-3 border-b border-white/[0.06]">
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>{navLink(to, label, icon)}</li>
          ))}
        </ul>

        {profile?.role === 'admin' && (
          <>
            <div className="my-4 border-t border-white/[0.06]" />
            <p className="text-white/25 text-[10px] font-sans uppercase tracking-[0.18em] px-3 mb-2">Admin</p>
            <ul className="flex flex-col gap-0.5">
              {adminNavItems.map(({ to, label, icon }) => (
                <li key={to}>{navLink(to, label, icon)}</li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/[0.07]">
        <NotificationsButton />
        <InstallButton />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-teal/40 to-brand-mid flex items-center justify-center flex-shrink-0 ring-1 ring-white/10 shadow-inner">
            <span className="text-sm font-semibold text-white font-sans">
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-medium font-sans truncate">
              {profile?.full_name ?? 'Usuario'}
            </p>
            <p className="text-[11px] text-white/30 font-sans capitalize tracking-wide">{profile?.role ?? ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-white/35 hover:text-white/75 hover:bg-white/[0.05] justify-start text-xs font-sans gap-2"
          onClick={signOut}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
