import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import type { Client, PipelineStage } from '@/types/database'
import { channelLabel, channelColor } from './channels'

type StatDetail = 'total' | 'won' | 'recent' | 'conversion'

type DetailRow = Pick<Client, 'id' | 'full_name' | 'phone' | 'channel' | 'created_at' | 'stage_id'>

const META: Record<StatDetail, { title: string; emoji: string; empty: string }> = {
  total:      { title: 'Total de leads',               emoji: '📊', empty: 'Aún no hay clientes registrados.' },
  won:        { title: 'Leads ganados',                emoji: '🏆', empty: 'Todavía no hay leads ganados.' },
  recent:     { title: 'Nuevos en los últimos 7 días', emoji: '⚡', empty: 'Sin nuevos leads esta semana.' },
  conversion: { title: 'Conversión',                   emoji: '🎯', empty: 'Todavía no hay leads ganados.' },
}

interface DetailData {
  rows: DetailRow[]
  stages: PipelineStage[]
  totalCount: number
  title: string
  emoji: string
  empty: string
}

const STAT_KEYS: StatDetail[] = ['total', 'won', 'recent', 'conversion']

function useStatDetail(detail: StatDetail | null, stageId: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'stat-detail-page', detail, stageId],
    queryFn: async (): Promise<DetailData> => {
      const stagesRes = await supabase.from('pipeline_stages').select('*').order('position')
      const stages = (stagesRes.data ?? []) as PipelineStage[]
      const wonStageIds = stages.filter(s => s.is_won).map(s => s.id)

      let q = supabase
        .from('clients')
        .select('id, full_name, phone, channel, created_at, stage_id')
        .order('created_at', { ascending: false })

      let title = ''
      let emoji = '📋'
      let empty = 'Sin resultados.'

      if (stageId) {
        q = q.eq('stage_id', stageId)
        const stage = stages.find(s => s.id === stageId)
        title = stage?.name ?? 'Etapa'
        emoji = '🗂️'
        empty = 'No hay clientes en esta etapa.'
      } else if (detail) {
        const m = META[detail]
        title = m.title; emoji = m.emoji; empty = m.empty
        if (detail === 'won' || detail === 'conversion') q = q.in('stage_id', wonStageIds)
        if (detail === 'recent') {
          const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          q = q.gte('created_at', since)
        }
      }

      const { data } = await q
      const rows = (data ?? []) as DetailRow[]

      let totalCount = rows.length
      if (detail === 'conversion') {
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true })
        totalCount = count ?? 0
      }

      return { rows, stages, totalCount, title, emoji, empty }
    },
  })
}

export function StatDetailPage() {
  const params = useParams<{ detail?: string; stageId?: string }>()
  const stageId = params.stageId ?? null
  const detail = (params.detail && STAT_KEYS.includes(params.detail as StatDetail))
    ? (params.detail as StatDetail)
    : null

  const { data, isLoading } = useStatDetail(detail, stageId)

  const rows = data?.rows ?? []
  const stageById = new Map((data?.stages ?? []).map(s => [s.id, s]))
  const isConversion = detail === 'conversion'
  const conversionRate =
    isConversion && data && data.totalCount > 0
      ? Math.round((rows.length / data.totalCount) * 100)
      : 0

  const subtitle = isConversion
    ? `${rows.length} ganados de ${data?.totalCount ?? 0} · ${conversionRate}%`
    : `${rows.length} ${rows.length === 1 ? 'cliente' : 'clientes'}`

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">

        {/* Back */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-sans text-brand-charcoal/60 hover:text-brand-teal transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al inicio
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 md:mb-6">
          <span className="text-2xl md:text-3xl">{data?.emoji ?? '📋'}</span>
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-brand-dark leading-tight">
              {data?.title ?? 'Detalle'}
            </h1>
            {!isLoading && (
              <p className="text-brand-charcoal/55 font-sans text-sm mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-card shadow-card p-2 sm:p-3">
          {isLoading ? (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-brand-light-gray animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-brand-charcoal/40 text-sm font-sans text-center py-12">
              {data?.empty ?? 'Sin resultados.'}
            </p>
          ) : (
            <ul className="divide-y divide-brand-light-gray/70">
              {rows.map(lead => {
                const stage = lead.stage_id ? stageById.get(lead.stage_id) : undefined
                return (
                  <li key={lead.id}>
                    <Link
                      to={`/clients/${lead.id}`}
                      className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-[#f4f5f7] active:bg-[#eef0f2] transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold font-sans"
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
                        <p className="text-xs text-brand-charcoal/40 font-sans truncate">
                          {channelLabel[lead.channel] ?? lead.channel}
                          {lead.phone ? ` · ${lead.phone}` : ''}
                        </p>
                      </div>
                      {stage && (
                        <span
                          className="hidden sm:inline-block text-[10px] font-sans font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color + '1f', color: stage.color }}
                        >
                          {stage.name}
                        </span>
                      )}
                      <p className="text-[11px] text-brand-charcoal/35 font-sans flex-shrink-0 tabular-nums">
                        {new Date(lead.created_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' })}
                      </p>
                      <svg className="w-4 h-4 text-brand-charcoal/25 flex-shrink-0 group-hover:text-brand-teal transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
