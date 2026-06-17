import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { useProfiles } from '@/hooks/useProfiles'
import { createClient } from '@/lib/mutations'
import { Select } from '@/components/Select'

interface NewClientModalProps {
  open: boolean
  onClose: () => void
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'web_chat', label: 'Web Chat' },
  { value: 'other', label: 'Otro' },
]

const INTEREST_OPTIONS = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'construction', label: 'Construcción' },
  { value: 'concierge', label: 'Concierge' },
  { value: 'other', label: 'Otro' },
]

export function NewClientModal({ open, onClose }: NewClientModalProps) {
  const queryClient = useQueryClient()
  const { data: stages = [] } = usePipelineStages()
  const { data: agents = [] } = useProfiles()

  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', channel: 'whatsapp',
    interest_type: '', budget_range: '', stage_id: '', assigned_to: '',
    source: 'Manual', follow_up_at: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => createClient({
      full_name:     form.full_name || null,
      phone:         form.phone || null,
      email:         form.email || null,
      channel:       form.channel as 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other',
      channel_user_id: form.phone || form.email || `manual-${Date.now()}`,
      interest_type: (form.interest_type || null) as 'real_estate' | 'construction' | 'concierge' | 'other' | null,
      budget_range:  form.budget_range || null,
      stage_id:      form.stage_id || null,
      assigned_to:   form.assigned_to || null,
      source:        form.source,
      follow_up_at:  form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
      last_contact_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setForm({ full_name: '', phone: '', email: '', channel: 'whatsapp', interest_type: '', budget_range: '', stage_id: '', assigned_to: '', source: 'Manual', follow_up_at: '' })
      onClose()
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray sticky top-0 bg-white z-10">
          <h2 className="font-sans font-semibold text-xl text-brand-dark">Nuevo cliente</h2>
          <button onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-dark transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <Field label="Nombre completo">
            <input className={input} placeholder="Ej. María García" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input className={input} placeholder="+503 7777 0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={input} type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Canal">
              <Select options={CHANNEL_OPTIONS} value={form.channel} onChange={e => set('channel', e.target.value)} />
            </Field>
            <Field label="Tipo de interés">
              <Select options={INTEREST_OPTIONS} value={form.interest_type} onChange={e => set('interest_type', e.target.value)} placeholder="Sin especificar" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Presupuesto">
              <input className={input} placeholder="Ej. $150,000" value={form.budget_range} onChange={e => set('budget_range', e.target.value)} />
            </Field>
            <Field label="Fuente">
              <input className={input} placeholder="Manual, Referido…" value={form.source} onChange={e => set('source', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Etapa del pipeline">
              <Select options={stages.map(s => ({ value: s.id, label: s.name }))} value={form.stage_id} onChange={e => set('stage_id', e.target.value)} placeholder="Sin etapa" />
            </Field>
            <Field label="Agente asignado">
              <Select options={agents.map(a => ({ value: a.id, label: a.full_name }))} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Sin asignar" />
            </Field>
          </div>

          <Field label="Próximo seguimiento">
            <input className={input} type="date" value={form.follow_up_at} onChange={e => set('follow_up_at', e.target.value)} />
          </Field>

          {mutation.isError && (
            <p className="text-xs text-red-500 font-sans">{(mutation.error as Error).message}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-light-gray flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-sans text-brand-charcoal/60 hover:text-brand-dark transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-brand-teal text-white text-sm font-medium font-sans rounded-button hover:bg-brand-deep transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando…' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-brand-charcoal/60 font-sans uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const input = 'w-full text-sm font-sans text-brand-dark bg-white border border-brand-light-gray rounded-button px-3 py-2 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/30'
