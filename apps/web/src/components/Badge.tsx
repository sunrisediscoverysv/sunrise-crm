import type { ReactNode } from 'react'

interface BadgeProps {
  color?: string
  children: ReactNode
  className?: string
}

export function Badge({ color = '#888887', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-medium font-sans ${className}`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {children}
    </span>
  )
}

interface ChannelBadgeProps {
  channel: 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other'
}

const channelConfig = {
  whatsapp:  { label: 'WhatsApp',  color: '#25d366' },
  instagram: { label: 'Instagram', color: '#e1306c' },
  messenger: { label: 'Messenger', color: '#0084ff' },
  web_chat:  { label: 'Web Chat',  color: '#03a5af' },
  other:     { label: 'Otro',      color: '#888887' },
}

export function ChannelBadge({ channel }: ChannelBadgeProps) {
  const { label, color } = channelConfig[channel]
  return <Badge color={color}>{label}</Badge>
}
