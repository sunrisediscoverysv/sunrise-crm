// Reglas de multimedia de la WhatsApp Cloud API, del lado del CRM.
// Mantener en sincronía con supabase/functions/whatsapp/index.ts, que es quien
// decide de verdad (este archivo solo adelanta los errores en la UI).

export type MediaKind = 'image' | 'video' | 'audio' | 'document'

/**
 * Un archivo del hilo. Los que envía el CRM (raw_payload.media) viven en el
 * bucket privado (`storage_path`); los que llegan por Chatwoot
 * (raw_payload.attachments) traen un enlace público de Chatwoot (`url`).
 */
export interface ChatMedia {
  kind: MediaKind
  storage_path?: string
  url?: string
  file_name: string
  mime_type: string
  size: number
}

export const CHAT_MEDIA_BUCKET = 'client-attachments'

const MB = 1024 * 1024
export const WHATSAPP_MEDIA_LIMITS: Record<MediaKind, number> = {
  image: 5 * MB, video: 16 * MB, audio: 16 * MB, document: 25 * MB,
}

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento',
}

/** `accept` del selector de archivos: los tipos que WhatsApp envía tal cual + documentos comunes. */
export const WHATSAPP_MEDIA_ACCEPT = [
  'image/jpeg', 'image/png',
  'video/mp4', 'video/3gpp',
  'audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
].join(',')

export function whatsappMediaKind(mime: string): MediaKind {
  const m = mime.toLowerCase().split(';')[0].trim()
  if (m === 'image/jpeg' || m === 'image/png') return 'image'
  if (m === 'video/mp4' || m === 'video/3gpp') return 'video'
  if (['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(m)) return 'audio'
  return 'document'
}

/** Mensaje de error si el archivo no se puede enviar, o null si está bien. */
export function validateWhatsappMedia(file: File): string | null {
  if (file.size === 0) return 'El archivo está vacío.'
  const kind = whatsappMediaKind(file.type)
  const limit = WHATSAPP_MEDIA_LIMITS[kind]
  if (file.size > limit) {
    return `${MEDIA_KIND_LABEL[kind]} demasiado grande: WhatsApp permite hasta ${limit / MB} MB.`
  }
  return null
}

export function chatMediaPath(clientId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_') || 'archivo'
  return `${clientId}/chat/${Date.now()}-${safeName}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}

/** Extrae el adjunto de un mensaje, si lo tiene. */
export function messageMedia(rawPayload: unknown): { media: ChatMedia; caption: string | null } | null {
  const p = rawPayload as { media?: Partial<ChatMedia>; caption?: string | null } | null
  const m = p?.media
  if (!m?.storage_path || !m.kind) return null
  return {
    media: {
      kind: m.kind,
      storage_path: m.storage_path,
      file_name: m.file_name ?? 'archivo',
      mime_type: m.mime_type ?? '',
      size: m.size ?? 0,
    },
    caption: p?.caption ?? null,
  }
}

/** Adjuntos de un mensaje reflejado desde Chatwoot (raw_payload.attachments). */
export function chatwootMedia(rawPayload: unknown): ChatMedia[] {
  const list = (rawPayload as { attachments?: unknown } | null)?.attachments
  if (!Array.isArray(list)) return []
  const kinds: MediaKind[] = ['image', 'video', 'audio', 'document']
  return list
    .filter((a): a is { kind?: string; url: string; file_name?: string; size?: number } =>
      typeof a?.url === 'string' && a.url !== '')
    .map(a => ({
      kind: kinds.includes(a.kind as MediaKind) ? (a.kind as MediaKind) : 'document',
      url: a.url,
      file_name: a.file_name || 'archivo',
      mime_type: '',
      size: Number(a.size ?? 0) || 0,
    }))
}

/**
 * true si el mensaje es un "[Adjunto]" de Chatwoot cuyo enlace aún no se ha
 * buscado (mensajes guardados antes de que el webhook guardara los adjuntos).
 */
export function needsChatwootAttachments(content: string | null, rawPayload: unknown): boolean {
  const p = rawPayload as { chatwoot_message_id?: unknown; attachments?: unknown } | null
  return content === '[Adjunto]' && p?.chatwoot_message_id != null && p.attachments === undefined
}
