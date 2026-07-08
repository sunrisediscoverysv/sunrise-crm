import type { ReactNode } from 'react'
import { Button } from '@/components/Button'

// UI compartida del módulo de Operaciones: modal de formulario, campos y
// entrada de dinero como texto (evita el bug del "0" inicial de type=number).

export const INPUT =
  'w-full text-sm font-sans text-brand-dark bg-white border border-brand-light-gray rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/30'

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-brand-charcoal/60 font-sans uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/** Entrada de dinero: texto con teclado decimal; guarda string ("" = vacío). */
export function MoneyInput({ value, onChange, placeholder = '0.00', autoFocus = false }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-charcoal/40 font-sans">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        autoFocus={autoFocus}
        onChange={e => {
          // Solo dígitos y un punto decimal.
          const clean = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
          onChange(clean)
        }}
        placeholder={placeholder}
        className={INPUT + ' pl-7'}
      />
    </div>
  )
}

/** Convierte el string de MoneyInput a número (null si está vacío/inválido). */
export function parseAmount(v: string): number | null {
  const n = Number(v)
  return v.trim() === '' || !Number.isFinite(n) ? null : n
}

interface OpsModalProps {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: () => void
  saving: boolean
  error: string | null
  submitLabel?: string
  children: ReactNode
}

export function OpsModal({ open, title, onClose, onSubmit, saving, error, submitLabel = 'Guardar', children }: OpsModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray sticky top-0 bg-white z-10">
          <h2 className="font-sans font-semibold text-xl text-brand-dark">{title}</h2>
          <button onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-dark transition-colors p-1" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          className="px-6 py-5 flex flex-col gap-4"
          onSubmit={e => { e.preventDefault(); onSubmit() }}
        >
          {children}
          {error && (
            <p className="text-sm text-red-500 font-sans bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </form>

        <div className="px-6 py-4 border-t border-brand-light-gray flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-sans text-brand-charcoal/60 hover:text-brand-dark transition-colors">
            Cancelar
          </button>
          <Button size="md" loading={saving} onClick={onSubmit}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  )
}

/** Botón "+ Nuevo …" de cada pestaña. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep hover:-translate-y-px active:translate-y-0 transition-all duration-200"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  )
}

/** Confirmación inline de borrado para filas de tabla. */
export function RowDelete({ confirming, onAsk, onConfirm, onCancel, busy }: {
  confirming: boolean
  onAsk: () => void
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 justify-end">
        <button onClick={onConfirm} disabled={busy} className="text-xs font-sans font-semibold text-white bg-red-500 rounded-button px-2.5 py-1 hover:bg-red-600 disabled:opacity-50">
          Sí, eliminar
        </button>
        <button onClick={onCancel} className="text-xs font-sans text-brand-charcoal/60 px-1.5 py-1 hover:text-brand-dark">No</button>
      </span>
    )
  }
  return (
    <button onClick={onAsk} className="text-brand-charcoal/30 hover:text-red-500 transition-colors p-1" title="Eliminar" aria-label="Eliminar">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}
