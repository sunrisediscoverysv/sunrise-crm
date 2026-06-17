import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { ChannelBadge } from './Badge'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { data: results = [], isFetching } = useClients(
    query.length >= 2 ? { search: query } : {},
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  function goTo(id: string) {
    navigate(`/clients/${id}`)
    setOpen(false)
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-sans text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-button transition-colors w-full"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-left">Buscar clientes…</span>
        <kbd className="hidden lg:inline text-xs bg-white/10 px-1.5 py-0.5 rounded font-sans">⌘K</kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-card shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-light-gray">
              <svg className="w-5 h-5 text-brand-charcoal/40 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nombre, teléfono o email…"
                className="flex-1 text-sm font-sans text-brand-dark outline-none placeholder:text-brand-charcoal/30"
              />
              {isFetching && <span className="h-4 w-4 border-2 border-brand-teal border-t-transparent rounded-full animate-spin flex-shrink-0" />}
              <kbd className="text-xs text-brand-charcoal/30 font-sans bg-brand-light-gray px-1.5 py-0.5 rounded">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {query.length < 2 ? (
                <p className="text-xs text-brand-charcoal/40 font-sans text-center py-8">Escribe al menos 2 caracteres para buscar</p>
              ) : results.length === 0 && !isFetching ? (
                <p className="text-xs text-brand-charcoal/40 font-sans text-center py-8">Sin resultados para "{query}"</p>
              ) : (
                <ul className="divide-y divide-brand-light-gray">
                  {results.slice(0, 8).map(client => {
                    const stage = client.pipeline_stages as { name: string; color: string } | null
                    return (
                      <li key={client.id}>
                        <button
                          onClick={() => goTo(client.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-light-gray/50 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-brand-dark font-sans truncate">
                              {client.full_name ?? 'Sin nombre'}
                            </p>
                            <p className="text-xs text-brand-charcoal/50 font-sans truncate">
                              {[client.phone, client.email].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ChannelBadge channel={client.channel} />
                            {stage && (
                              <span className="text-xs font-sans px-2 py-0.5 rounded-pill" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
                                {stage.name}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
