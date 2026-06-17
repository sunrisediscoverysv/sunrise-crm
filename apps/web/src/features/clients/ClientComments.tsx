import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { addComment } from '@/lib/mutations'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClientCommentsProps {
  clientId: string
}

interface CommentWithAuthor {
  id: string
  content: string
  created_at: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

function useComments(clientId: string) {
  return useQuery({
    queryKey: ['comments', clientId],
    queryFn: async (): Promise<CommentWithAuthor[]> => {
      const { data, error } = await supabase
        .from('client_comments')
        .select('id, content, created_at, profiles:author_id ( full_name, avatar_url )')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as CommentWithAuthor[]
    },
  })
}

export function ClientComments({ clientId }: ClientCommentsProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: comments = [], isLoading } = useComments(clientId)
  const [text, setText] = useState('')

  const submitComment = useMutation({
    mutationFn: (content: string) =>
      addComment({ client_id: clientId, author_id: user!.id, content }),
    onSuccess: () => {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['comments', clientId] })
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    submitComment.mutate(trimmed)
  }

  return (
    <section>
      <h3 className="font-display text-lg text-brand-dark mb-4">Comentarios internos</h3>

      <div className="flex flex-col gap-4 mb-5">
        {isLoading ? (
          <div className="h-16 bg-brand-light-gray rounded-card animate-pulse" />
        ) : comments.length === 0 ? (
          <p className="text-sm text-brand-charcoal/40 font-sans py-4 text-center">
            Aún no hay comentarios sobre este cliente.
          </p>
        ) : (
          comments.map(comment => {
            const author = comment.profiles as { full_name: string; avatar_url: string | null } | null
            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar name={author?.full_name} src={author?.avatar_url} size="sm" className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 bg-[#f7f8f9] rounded-card p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-brand-dark font-sans">
                      {author?.full_name ?? 'Equipo'}
                    </span>
                    <span className="text-xs text-brand-charcoal/40 font-sans">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  <p className="text-sm text-brand-charcoal font-serif leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Agregar nota interna sobre este cliente…"
          rows={3}
          className={[
            'w-full px-4 py-3 text-sm font-serif text-brand-charcoal bg-white',
            'border border-brand-light-gray rounded-card resize-none',
            'focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal',
            'placeholder:text-brand-charcoal/30 transition-colors',
          ].join(' ')}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={submitComment.isPending}
            disabled={!text.trim()}
          >
            Agregar comentario
          </Button>
        </div>
      </form>
    </section>
  )
}
