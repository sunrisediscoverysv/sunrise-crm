// Etiquetas, colores y formato compartidos por el módulo de Operaciones.

export function money(n: number | null | undefined): string {
  const v = n ?? 0
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const DEAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  closed:    { label: 'Cerrada',   color: '#22c55e', bg: 'bg-emerald-50 text-emerald-700' },
  pending:   { label: 'En proceso', color: '#eebb69', bg: 'bg-amber-50 text-amber-700' },
  cancelled: { label: 'Cancelada', color: '#ef4444', bg: 'bg-red-50 text-red-600' },
}

export const TASK_STATUS: Record<string, { label: string; bg: string }> = {
  pending:     { label: 'Pendiente',  bg: 'bg-gray-100 text-brand-charcoal/70' },
  in_progress: { label: 'En curso',   bg: 'bg-blue-50 text-blue-600' },
  done:        { label: 'Completada', bg: 'bg-emerald-50 text-emerald-700' },
}

export const TASK_PRIORITY: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Baja',  color: '#94a3b8', bg: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Media', color: '#03a5af', bg: 'bg-brand-teal/10 text-brand-teal' },
  high:   { label: 'Alta',  color: '#ef4444', bg: 'bg-red-50 text-red-600' },
}

export const PAYMENT_STATUS: Record<string, { label: string; bg: string }> = {
  pending: { label: 'Pendiente', bg: 'bg-amber-50 text-amber-700' },
  paid:    { label: 'Pagado',    bg: 'bg-emerald-50 text-emerald-700' },
  overdue: { label: 'Vencido',   bg: 'bg-red-50 text-red-600' },
}
