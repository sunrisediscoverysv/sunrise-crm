import type { Property } from '@/types/database'

export const STATUS_META: Record<Property['status'], { label: string; color: string }> = {
  available:  { label: 'Disponible', color: '#03a5af' },
  reserved:   { label: 'Reservada',  color: '#eebb69' },
  sold:       { label: 'Vendida',    color: '#6b7280' },
  off_market: { label: 'Fuera de mercado', color: '#9ca3af' },
}

export const TYPE_LABEL: Record<Property['property_type'], string> = {
  land: 'Terreno', house: 'Casa', department: 'Apartamento', lot: 'Lote', other: 'Otro',
}

export const TYPE_COLOR: Record<Property['property_type'], string> = {
  land: '#03a5af', house: '#eebb69', department: '#6366f1', lot: '#22c55e', other: '#9ca3af',
}

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}
