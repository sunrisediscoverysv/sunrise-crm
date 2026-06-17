import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-brand-charcoal font-sans">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full px-4 py-2.5 text-sm font-sans text-brand-charcoal bg-white',
          'border rounded-lg transition-colors duration-150',
          'placeholder:text-brand-charcoal/40',
          'focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal',
          error ? 'border-red-400' : 'border-brand-light-gray',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
    </div>
  )
}
