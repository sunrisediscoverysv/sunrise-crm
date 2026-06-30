import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { functionsErrorMessage } from '@/lib/functions'
import {
  useWhatsappTemplates, templateBody, templateVarCount, fillTemplate,
  templateHeaderFormat, templateHeaderExample,
  type WhatsappTemplate,
} from '@/hooks/useWhatsappTemplates'
import { Select } from '@/components/Select'

interface SendTemplateModalProps {
  open: boolean
  onClose: () => void
  client: { id: string; full_name: string | null; phone: string | null }
}

const input =
  'w-full text-sm font-sans text-brand-dark bg-white border border-brand-light-gray rounded-button px-3 py-2 outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-colors placeholder:text-brand-charcoal/30'

export function SendTemplateModal({ open, onClose, client }: SendTemplateModalProps) {
  const queryClient = useQueryClient()
  const { data: templates = [], isLoading, error: loadError } = useWhatsappTemplates(open)

  const [selectedName, setSelectedName] = useState('')
  const [values, setValues] = useState<string[]>([])
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  const [sent, setSent] = useState(false)

  const selected = useMemo<WhatsappTemplate | null>(
    () => templates.find(t => t.name === selectedName) ?? null,
    [templates, selectedName],
  )

  const headerFormat = selected ? templateHeaderFormat(selected) : null
  const needsImage = headerFormat === 'IMAGE'

  // Al elegir plantilla, preparar los inputs de variables (prefijar la 1ª con el nombre)
  useEffect(() => {
    if (!selected) { setValues([]); setHeaderImageUrl(''); return }
    const count = templateVarCount(selected)
    const firstName = client.full_name?.split(' ')[0] ?? ''
    setValues(Array.from({ length: count }, (_, i) => (i === 0 ? firstName : '')))
    setHeaderImageUrl(templateHeaderExample(selected) ?? '')
  }, [selected, client.full_name])

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Elige una plantilla.')
      if (!client.phone) throw new Error('Este cliente no tiene número de WhatsApp.')
      const { error } = await supabase.functions.invoke('whatsapp', {
        body: {
          action: 'send',
          client_id: client.id,
          to: client.phone,
          template_name: selected.name,
          language: selected.language,
          variables: values,
          ...(needsImage && headerImageUrl ? { header_image_url: headerImageUrl } : {}),
        },
      })
      if (error) throw new Error(await functionsErrorMessage(error, 'No se pudo enviar la plantilla.'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', client.id] })
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      setSent(true)
    },
  })

  function close() {
    setSelectedName('')
    setValues([])
    setHeaderImageUrl('')
    setSent(false)
    sendMutation.reset()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white rounded-card shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray sticky top-0 bg-white z-10">
          <h2 className="font-sans font-semibold text-xl text-brand-dark flex items-center gap-2">
            <span className="text-[#25D366]">●</span> Enviar plantilla de WhatsApp
          </h2>
          <button onClick={close} className="text-brand-charcoal/40 hover:text-brand-dark transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Destinatario */}
          <div className="text-sm font-sans">
            <span className="text-brand-charcoal/50">Para: </span>
            <span className="text-brand-dark font-medium">{client.full_name ?? 'Sin nombre'}</span>
            {client.phone
              ? <span className="text-brand-charcoal/50"> · {client.phone}</span>
              : <span className="text-red-500"> · sin número de WhatsApp</span>}
          </div>

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-6 text-center">
              <p className="text-green-700 font-sans font-medium">✓ Plantilla enviada</p>
              <p className="text-green-600/70 text-sm font-sans mt-1">Quedó registrada en el historial del cliente.</p>
            </div>
          ) : isLoading ? (
            <p className="text-sm text-brand-charcoal/40 font-sans py-4 text-center">Cargando plantillas…</p>
          ) : loadError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
              <p className="text-amber-700 text-sm font-sans">{(loadError as Error).message}</p>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-brand-charcoal/50 font-sans py-4 text-center">
              No hay plantillas aprobadas en Meta todavía.
            </p>
          ) : (
            <>
              <Field label="Plantilla">
                <Select
                  options={templates.map(t => ({ value: t.name, label: `${t.name} (${t.language})` }))}
                  value={selectedName}
                  onChange={e => setSelectedName(e.target.value)}
                  placeholder="Elige una plantilla…"
                />
              </Field>

              {selected && (
                <>
                  {/* Imagen de encabezado (plantillas con header IMAGE) */}
                  {needsImage && (
                    <Field label="URL de imagen del encabezado">
                      <input
                        className={input}
                        value={headerImageUrl}
                        onChange={e => setHeaderImageUrl(e.target.value)}
                        placeholder="https://…/imagen.jpg"
                      />
                      <p className="text-[11px] text-brand-charcoal/40 font-sans mt-1">
                        Esta plantilla lleva imagen. Se rellenó con la imagen de ejemplo; puedes cambiarla por una URL pública.
                      </p>
                    </Field>
                  )}

                  {/* Variables */}
                  {values.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {values.map((v, i) => (
                        <Field key={i} label={`Variable {{${i + 1}}}`}>
                          <input
                            className={input}
                            value={v}
                            onChange={e => setValues(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                            placeholder={`Valor para {{${i + 1}}}`}
                          />
                        </Field>
                      ))}
                    </div>
                  )}

                  {/* Vista previa */}
                  <div>
                    <label className="block text-xs font-medium text-brand-charcoal/60 font-sans uppercase tracking-wider mb-1.5">Vista previa</label>
                    <div className="bg-[#e6f5eb] rounded-xl rounded-tl-sm px-4 py-3 text-sm font-sans text-brand-dark whitespace-pre-wrap leading-relaxed">
                      {fillTemplate(selected, values) || templateBody(selected)}
                    </div>
                  </div>
                </>
              )}

              {sendMutation.isError && (
                <p className="text-xs text-red-500 font-sans">{(sendMutation.error as Error).message}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-light-gray flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={close} className="px-4 py-2 text-sm font-sans text-brand-charcoal/60 hover:text-brand-dark transition-colors">
            {sent ? 'Cerrar' : 'Cancelar'}
          </button>
          {!sent && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !selected || !client.phone || (needsImage && !headerImageUrl)}
              className="px-5 py-2 bg-[#25D366] text-white text-sm font-medium font-sans rounded-button hover:bg-[#1da851] transition-colors disabled:opacity-50"
            >
              {sendMutation.isPending ? 'Enviando…' : 'Enviar'}
            </button>
          )}
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
