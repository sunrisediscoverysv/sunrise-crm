import type { ReactNode } from 'react'

/** Pick a readable text color (dark or white) for a given solid background. */
function readableText(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return '#ffffff'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#114252' : '#ffffff'
}

interface BadgeProps {
  color?: string
  children: ReactNode
  className?: string
}

/** Monday-style solid status label. */
export function Badge({ color = '#888887', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-semibold font-sans whitespace-nowrap ${className}`}
      style={{ backgroundColor: color, color: readableText(color) }}
    >
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
