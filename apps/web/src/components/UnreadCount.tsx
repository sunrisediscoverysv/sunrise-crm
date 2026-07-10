import { useUnreadCount } from '@/features/inbox/useInboxBadge'

interface UnreadCountProps {
  /** `pill` para la fila del sidebar; `dot` para el ícono de la barra móvil. */
  variant?: 'pill' | 'dot'
}

/**
 * Conversaciones sin contestar. Existe además del badge del ícono de la app
 * porque en Chrome para Android la Badging API no existe: ahí este número es la
 * única señal. A partir de 99 se corta, como WhatsApp.
 */
export function UnreadCount({ variant = 'pill' }: UnreadCountProps) {
  const unread = useUnreadCount()
  if (unread === 0) return null

  const label = unread > 99 ? '99+' : String(unread)
  const aria = `${unread} conversación${unread === 1 ? '' : 'es'} sin contestar`

  if (variant === 'dot') {
    return (
      <span
        aria-label={aria}
        className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-teal text-white text-[10px] font-sans font-bold leading-4 text-center ring-2 ring-brand-dark"
      >
        {label}
      </span>
    )
  }

  // Blanco y no teal: el ítem activo del sidebar ya tiene fondo teal, y un badge
  // teal sobre teal desaparece. El blanco contrasta en ambos estados.
  return (
    <span
      aria-label={aria}
      className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-white text-brand-dark text-[11px] font-sans font-bold leading-5 text-center"
    >
      {label}
    </span>
  )
}
