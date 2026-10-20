import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { CHAT_MEDIA_BUCKET, formatFileSize, type ChatMedia } from './whatsappMedia'

// El bucket es privado: cada adjunto se muestra con una URL firmada de 1h,
// cacheada por React Query un poco menos para no servir una ya vencida.
const SIGNED_URL_TTL_S = 60 * 60

function useSignedUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['chat-media-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(path!, SIGNED_URL_TTL_S)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_S - 5 * 60) * 1000,
  })
}

export function ChatMediaPreview({ media, onDark }: { media: ChatMedia; onDark: boolean }) {
  // Los adjuntos de Chatwoot ya traen su enlace; los del bucket se firman
  const signed = useSignedUrl(media.url ? undefined : media.storage_path)
  const url = media.url ?? signed.data
  const isLoading = !media.url && signed.isLoading
  const isError = !media.url && signed.isError

  if (isLoading) {
    return <div className="w-56 h-32 rounded-card bg-white/10 animate-pulse" />
  }

  if (isError || !url) {
    return (
      <p className={`text-xs font-sans ${onDark ? 'text-white/60' : 'text-brand-charcoal/50'}`}>
        No se pudo cargar el archivo «{media.file_name}».
      </p>
    )
  }

  if (media.kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={media.file_name}
          className="max-w-full w-64 max-h-72 object-cover rounded-card"
          loading="lazy"
        />
      </a>
    )
  }

  if (media.kind === 'video') {
    return <video src={url} controls preload="metadata" className="max-w-full w-64 rounded-card" />
  }

  if (media.kind === 'audio') {
    return <audio src={url} controls preload="metadata" className="w-60 max-w-full" />
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={[
        'flex items-center gap-3 rounded-card px-3 py-2.5 min-w-[13rem] transition-colors',
        onDark ? 'bg-white/10 hover:bg-white/15' : 'bg-brand-light-gray/60 hover:bg-brand-light-gray',
      ].join(' ')}
    >
      <svg className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="min-w-0">
        <span className="block text-sm font-sans font-medium truncate">{media.file_name}</span>
        {media.size > 0 && (
          <span className={`block text-xs font-sans ${onDark ? 'text-white/50' : 'text-brand-charcoal/45'}`}>
            {formatFileSize(media.size)}
          </span>
        )}
      </span>
    </a>
  )
}
