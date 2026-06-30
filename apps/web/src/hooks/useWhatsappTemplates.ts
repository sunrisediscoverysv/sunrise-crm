import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { functionsErrorMessage } from '@/lib/functions'

export interface TemplateComponent {
  type: string // 'BODY' | 'HEADER' | 'FOOTER' | 'BUTTONS'
  text?: string
  format?: string // en HEADER: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  example?: { header_handle?: string[]; body_text?: string[][] }
}

export interface WhatsappTemplate {
  name: string
  language: string
  category: string
  components: TemplateComponent[]
}

// Devuelve el texto del cuerpo de la plantilla (con los {{n}})
export function templateBody(t: WhatsappTemplate): string {
  const body = t.components?.find(c => c.type?.toUpperCase() === 'BODY')
  return body?.text ?? ''
}

// Cantidad de variables {{1}}, {{2}}… en el cuerpo
export function templateVarCount(t: WhatsappTemplate): number {
  const matches = templateBody(t).match(/\{\{\s*\d+\s*\}\}/g)
  if (!matches) return 0
  const nums = matches.map(m => parseInt(m.replace(/[^\d]/g, ''), 10))
  return Math.max(0, ...nums)
}

// Formato del encabezado: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null
export function templateHeaderFormat(t: WhatsappTemplate): string | null {
  const h = t.components?.find(c => c.type?.toUpperCase() === 'HEADER')
  return h?.format?.toUpperCase() ?? null
}

// URL de ejemplo del encabezado de imagen (sirve como valor por defecto)
export function templateHeaderExample(t: WhatsappTemplate): string | null {
  const h = t.components?.find(c => c.type?.toUpperCase() === 'HEADER')
  return h?.example?.header_handle?.[0] ?? null
}

// Reemplaza {{1}}, {{2}}… por los valores dados (para la vista previa)
export function fillTemplate(t: WhatsappTemplate, values: string[]): string {
  return templateBody(t).replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const v = values[parseInt(n, 10) - 1]
    return v && v.trim() ? v : `{{${n}}}`
  })
}

export function useWhatsappTemplates(enabled = true) {
  return useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async (): Promise<WhatsappTemplate[]> => {
      const { data, error } = await supabase.functions.invoke('whatsapp', {
        body: { action: 'list' },
      })
      if (error) throw new Error(await functionsErrorMessage(error, 'No se pudieron cargar las plantillas.'))
      return (data as { templates: WhatsappTemplate[] }).templates ?? []
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}
