import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-14 h-14 rounded-full bg-brand-light-gray flex items-center justify-center mb-4 text-brand-charcoal/40">
          {icon}
        </div>
      )}
      <p className="font-sans font-semibold text-lg text-brand-dark mb-1">{title}</p>
      {description && <p className="text-sm text-brand-charcoal/50 font-sans max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
