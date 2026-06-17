interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const initial = name?.[0]?.toUpperCase() ?? '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-brand-teal/20 flex items-center justify-center flex-shrink-0 font-medium text-brand-teal font-sans ${className}`}
    >
      {initial}
    </div>
  )
}
