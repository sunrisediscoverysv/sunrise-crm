import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProperty } from '@/lib/mutations'
import { Select } from '@/components/Select'
import type { Property } from '@/types/database'

interface NewPropertyModalProps {
  open: boolean
  onClose: () => void
}

const TYPE_OPTIONS = [
  { value: 'land', label: 'Terreno' },
  { value: 'house', label: 'Casa' },
  { value: 'department', label: 'Apartamento' },
  { value: 'lot', label: 'Lote' },
  { value: 'other', label: 'Otro' },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible' },
  { value: 'reserved', label: 'Reservada' },
  { value: 'sold', label: 'Vendida' },
  { value: 'off_market', label: 'Fuera de mercado' },
]

const input =
  'w-full text-sm font-sans text-brand-dark bg-white border border-brand-light-gray rounded-button px-3 py-2 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/30'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-brand-charcoal/60 font-sans uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export function NewPropertyModal({ open, onClose }: NewPropertyModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '', location: '', property_type: 'land', price_label: '',
    price_usd: '', size_label: '', status: 'available', source_url: '', image_url: '', description: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => createProperty({
      name: form.name.trim(),
      location: form.location || null,
      property_type: form.property_type as Property['property_type'],
      price_label: form.price_label || null,
      price_usd: form.price_usd ? Number(form.price_usd.replace(/[^0-9.]/g, '')) : null,
      size_label: form.size_label || null,
      status: form.status as Property['status'],
      source_url: form.source_url || null,
      image_url: form.image_url || null,
      description: form.description || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      setForm({ name: '', location: '', property_type: 'land', price_label: '', price_usd: '', size_label: '', status: 'available', source_url: '', image_url: '', description: '' })
      onClose()
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray sticky top-0 bg-white z-10">
          <h2 className="font-display text-xl text-brand-dark">Nueva propiedad</h2>
          <button onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-dark transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <Field label="Nombre *">
            <input className={input} placeholder="Ej. Lote frente al mar - El Zonte" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Ubicación">
            <input className={input} placeholder="Ej. El Zonte, La Libertad" value={form.location} onChange={e => set('location', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select options={TYPE_OPTIONS} value={form.property_type} onChange={e => set('property_type', e.target.value)} />
            </Field>
            <Field label="Estado">
              <Select options={STATUS_OPTIONS} value={form.status} onChange={e => set('status', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio (texto)">
              <input className={input} placeholder="Ej. $150,000 o $65/v²" value={form.price_label} onChange={e => set('price_label', e.target.value)} />
            </Field>
            <Field label="Precio USD (para ordenar)">
              <input className={input} placeholder="Ej. 150000" value={form.price_usd} onChange={e => set('price_usd', e.target.value)} />
            </Field>
          </div>

          <Field label="Tamaño">
            <input className={input} placeholder="Ej. 1,100 v²" value={form.size_label} onChange={e => set('size_label', e.target.value)} />
          </Field>
          <Field label="Enlace al sitio (opcional)">
            <input className={input} placeholder="https://sunrisediscovery.com/properties/…" value={form.source_url} onChange={e => set('source_url', e.target.value)} />
          </Field>
          <Field label="URL de imagen (opcional)">
            <input className={input} placeholder="https://…/foto.jpg" value={form.image_url} onChange={e => set('image_url', e.target.value)} />
          </Field>
          <Field label="Descripción (opcional)">
            <textarea className={`${input} resize-none`} rows={2} placeholder="Notas internas de la propiedad…" value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>

          {mutation.isError && (
            <p className="text-xs text-red-500 font-sans">{(mutation.error as Error).message}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-brand-light-gray flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-sans text-brand-charcoal/60 hover:text-brand-dark transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim()}
            className="px-5 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando…' : 'Crear propiedad'}
          </button>
        </div>
      </div>
    </div>
  )
}
