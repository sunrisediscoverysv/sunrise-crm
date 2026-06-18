import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { addClientAttachment } from '@/lib/mutations'
import { useAuth } from '@/features/auth/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ClientAttachment } from '@/types/database'

const BUCKET = 'client-attachments'
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mime: string | null) {
  const isImage = mime?.startsWith('image/')
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      {isImage ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      )}
    </svg>
  )
}

function useAttachments(clientId: string) {
  return useQuery({
    queryKey: ['attachments', clientId],
    queryFn: async (): Promise<ClientAttachment[]> => {
      const { data, error } = await supabase
        .from('client_attachments')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function ClientAttachments({ clientId }: { clientId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: files = [], isLoading } = useAttachments(clientId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error('El archivo supera el máximo de 25 MB.')
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${clientId}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
      if (upErr) throw upErr
      await addClientAttachment({
        client_id: clientId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      })
    },
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['attachments', clientId] })
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Error al subir el archivo.'),
  })

  const remove = useMutation({
    mutationFn: async (file: ClientAttachment) => {
      await supabase.storage.from(BUCKET).remove([file.file_path])
      const { error } = await supabase.from('client_attachments').delete().eq('id', file.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', clientId] }),
  })

  async function openFile(file: ClientAttachment) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.file_path, 120)
    if (error || !data) { setError('No se pudo abrir el archivo.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload.mutate(file)
    e.target.value = ''
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg text-brand-dark">Archivos adjuntos</h3>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-teal text-white text-xs font-semibold font-sans rounded-button shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)] hover:bg-brand-deep hover:-translate-y-px active:translate-y-0 transition-all duration-200 disabled:opacity-60"
        >
          {upload.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          )}
          Subir
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
      </div>

      {error && (
        <p className="text-xs text-red-500 font-sans bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-brand-light-gray animate-pulse" />)}
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-brand-charcoal/40 font-sans py-4 text-center">
          Sin archivos. Subí contratos, fotos o documentos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map(file => (
            <li
              key={file.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f7f8f9] hover:bg-brand-teal/[0.05] transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center flex-shrink-0">
                {fileIcon(file.mime_type)}
              </div>
              <button onClick={() => openFile(file)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-brand-dark font-sans truncate group-hover:text-brand-teal transition-colors">
                  {file.file_name}
                </p>
                <p className="text-[11px] text-brand-charcoal/40 font-sans">
                  {formatSize(file.file_size)}
                  {file.file_size ? ' · ' : ''}
                  {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: es })}
                </p>
              </button>
              <button
                onClick={() => remove.mutate(file)}
                disabled={remove.isPending}
                className="text-brand-charcoal/30 hover:text-red-500 transition-colors p-1.5 rounded-lg flex-shrink-0"
                aria-label="Eliminar archivo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
