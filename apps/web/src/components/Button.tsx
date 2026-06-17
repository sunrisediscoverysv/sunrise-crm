import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const variantClasses = {
  primary:   'bg-brand-teal text-white hover:bg-brand-deep disabled:bg-brand-teal/50',
  secondary: 'border border-brand-teal text-brand-teal hover:bg-brand-teal/10 disabled:opacity-50',
  ghost:     'text-brand-charcoal hover:bg-brand-light-gray disabled:opacity-50',
  danger:    'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300',
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
        'rounded-button transition-colors duration-150 cursor-pointer',
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
