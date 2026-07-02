import { NavLink } from 'react-router-dom'

interface MobileNavProps {
  /** Abre el drawer lateral con el resto de secciones (Calendario, Propiedades, Configuración…). */
  onOpenMenu: () => void
}

// Barra de navegación inferior, solo móvil. Existe porque en teléfonos grandes
// (iPhone Pro Max) el menú de la esquina superior queda fuera del alcance del
// pulgar; los destinos de uso diario van abajo y el resto vive en el drawer.
const tabs = [
  {
    to: '/dashboard',
    label: 'Inicio',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/inbox',
    label: 'Chats',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.83l-5 1.66 1.7-4.24A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    to: '/pipeline',
    label: 'Pipeline',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    to: '/clients',
    label: 'Clientes',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function MobileNav({ onOpenMenu }: MobileNavProps) {
  return (
    <nav
      className="lg:hidden flex items-stretch bg-brand-dark border-t border-white/10 flex-shrink-0 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            [
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 font-sans text-[10px] font-medium transition-colors',
              isActive ? 'text-brand-teal' : 'text-white/50 active:text-white',
            ].join(' ')
          }
        >
          {tab.icon}
          {tab.label}
        </NavLink>
      ))}
      <button
        onClick={onOpenMenu}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 font-sans text-[10px] font-medium text-white/50 active:text-white transition-colors"
        aria-label="Abrir menú completo"
      >
        <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Menú
      </button>
    </nav>
  )
}
