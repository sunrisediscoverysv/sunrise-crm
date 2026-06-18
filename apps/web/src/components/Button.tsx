import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const variantClasses = {
  primary:   'bg-brand-teal text-white shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep hover:-translate-y-px disabled:bg-brand-teal/50 disabled:shadow-none disabled:translate-y-0',
  secondary: 'border border-brand-teal text-brand-teal hover:bg-brand-teal/10 disabled:opacity-50',
  ghost:     'text-brand-charcoal hover:bg-brand-light-gray disabled:opacity-50',
  danger:    'bg-red-500 text-white shadow-sm hover:bg-red-600 hover:-translate-y-px disabled:bg-red-300',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-sans font-medium',
        'rounded-button transition-all duration-200 cursor-pointer active:translate-y-0 active:scale-[0.98]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
