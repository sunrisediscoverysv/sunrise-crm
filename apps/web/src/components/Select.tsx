import type { SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  placeholder?: string
  error?: string
}

export function Select({ label, options, placeholder, error, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-brand-charcoal font-sans">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={[
          'w-full px-4 py-2.5 text-sm font-sans text-brand-charcoal bg-white',
          'border rounded-lg transition-colors duration-150 cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal',
          error ? 'border-red-400' : 'border-brand-light-gray',
          className,
        ].join(' ')}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 font-sans">{error}</p>}
    </div>
  )
}
