import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import type { Client, PipelineStage } from '@/types/database'

export type StatDetail = 'total' | 'won' | 'recent' | 'conversion'

type DetailRow = Pick<Client, 'id' | 'full_name' | 'channel' | 'created_at' | 'stage_id'>

export const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
}
export const channelColor: Record<string, string> = {
  whatsapp: '#25D366', instagram: '#E1306C', messenger: '#0084FF',
  web_chat: '#03a5af', other: '#9ca3af',
}

const META: Record<StatDetail, { title: string; emoji: string; empty: string }> = {
  total:      { title: 'Total de leads',          emoji: '📊', empty: 'Aún no hay clientes registrados.' },
  won:        { title: 'Leads ganados',           emoji: '🏆', empty: 'Todavía no hay leads ganados.' },
  recent:     { title: 'Nuevos en los últimos 7 días', emoji: '⚡', empty: 'Sin nuevos leads esta semana.' },
  conversion: { title: 'Conversión',              emoji: '🎯', empty: 'Todavía no hay leads ganados.' },
}

interface DetailData {
  rows: DetailRow[]
  stages: PipelineStage[]
  totalCount: number
}

function useStatDetail(detail: StatDetail | null, open: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'stat-detail', detail],
    enabled: open && detail !== null,
    queryFn: async (): Promise<DetailData> => {
      const stagesRes = await supabase.from('pipeline_stages').select('*').order('position')
      const stages = (stagesRes.data ?? []) as PipelineStage[]
      const wonStageIds = stages.filter(s => s.is_won).map(s => s.id)

      let q = supabase
        .from('clients')
        .select('id, full_name, channel, created_at, stage_id')
        .order('created_at', { ascending: false })

      if (detail === 'won' || detail === 'conversion') q = q.in('stage_id', wonStageIds)
      if (detail === 'recent') {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        q = q.gte('created_at', since)
      }

      const { data } = await q
      const rows = (data ?? []) as DetailRow[]

      // Para la tarjeta de conversión necesitamos el total general como base del %.
      let totalCount = rows.length
      if (detail === 'conversion') {
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true })
        totalCount = count ?? 0
      }

      return { rows, stages, totalCount }
    },
  })
}

interface StatDetailModalProps {
  detail: StatDetail | null
  onClose: () => void
}

export function StatDetailModal({ detail, onClose }: StatDetailModalProps) {
  const open = detail !== null
  const { data, isLoading } = useStatDetail(detail, open)

  if (!detail) return null

  const meta = META[detail]
  const rows = data?.rows ?? []
  const stageById = new Map((data?.stages ?? []).map(s => [s.id, s]))
  const wonCount = detail === 'conversion' ? rows.length : 0
  const conversionRate =
    detail === 'conversion' && data && data.totalCount > 0
      ? Math.round((wonCount / data.totalCount) * 100)
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-light-gray">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{meta.emoji}</span>
            <div>
              <h2 className="font-sans font-semibold text-lg text-brand-dark leading-tight">{meta.title}</h2>
              {!isLoading && (
                <p className="text-xs text-brand-charcoal/40 font-sans">
                  {detail === 'conversion'
                    ? `${wonCount} ganados de ${data?.totalCount ?? 0} · ${conversionRate}%`
                    : `${rows.length} ${rows.length === 1 ? 'cliente' : 'clientes'}`}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-dark transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="px-3 py-3 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1.5 px-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-brand-light-gray animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-brand-charcoal/35 text-sm font-sans text-center py-10">{meta.empty}</p>
          ) : (
            <ul className="space-y-0.5">
              {rows.map(lead => {
                const stage = lead.stage_id ? stageById.get(lead.stage_id) : undefined
                return (
                  <li key={lead.id}>
                    <Link
                      to={`/clients/${lead.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f4f5f7] transition-colors group"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold font-sans"
                        style={{
                          backgroundColor: (channelColor[lead.channel] ?? '#9ca3af') + '22',
                          color: channelColor[lead.channel] ?? '#9ca3af',
                        }}
                      >
                        {(lead.full_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-charcoal font-sans truncate group-hover:text-brand-teal transition-colors">
                          {lead.full_name ?? 'Sin nombre'}
                        </p>
                        <p className="text-[11px] text-brand-charcoal/40 font-sans">{channelLabel[lead.channel] ?? lead.channel}</p>
                      </div>
                      {stage && (
                        <span
                          className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color + '1f', color: stage.color }}
                        >
                          {stage.name}
                        </span>
                      )}
                      <p className="text-[11px] text-brand-charcoal/30 font-sans flex-shrink-0 tabular-nums w-12 text-right">
                        {new Date(lead.created_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' })}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
