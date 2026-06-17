import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/features/auth/AuthContext'
import type { PipelineStage, Client } from '@/types/database'

interface StageCount {
  stage: PipelineStage
  count: number
}

type RecentLead = Pick<Client, 'id' | 'full_name' | 'channel' | 'created_at' | 'stage_id'>

function useStageStats() {
  return useQuery({
    queryKey: ['dashboard', 'stage-stats'],
    queryFn: async (): Promise<StageCount[]> => {
      const stagesRes = await supabase.from('pipeline_stages').select('*').order('position')
      const clientsRes = await supabase.from('clients').select('stage_id')
      const stages = (stagesRes.data ?? []) as PipelineStage[]
      const clients = (clientsRes.data ?? []) as Pick<Client, 'stage_id'>[]
      const countByStage: Record<string, number> = {}
      for (const c of clients) {
        if (c.stage_id) countByStage[c.stage_id] = (countByStage[c.stage_id] ?? 0) + 1
      }
      return stages.map(stage => ({ stage, count: countByStage[stage.id] ?? 0 }))
    },
  })
}

function useRecentLeads() {
  return useQuery({
    queryKey: ['dashboard', 'recent-leads'],
    queryFn: async (): Promise<RecentLead[]> => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, channel, created_at, stage_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10)
      return (data ?? []) as RecentLead[]
    },
  })
}

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  web_chat: 'Web Chat', other: 'Otro',
}
const channelColor: Record<string, string> = {
  whatsapp: '#25D366', instagram: '#E1306C', messenger: '#0084FF',
  web_chat: '#03a5af', other: '#9ca3af',
}

export function DashboardPage() {
  const { profile } = useAuth()
  const { data: stageStats, isLoading: loadingStats } = useStageStats()
  const { data: recentLeads, isLoading: loadingLeads } = useRecentLeads()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'equipo'

  const totalClients = stageStats?.reduce((s, { count }) => s + count, 0) ?? 0
  const wonCount = stageStats?.find(({ stage }) => stage.is_won)?.count ?? 0
  const conversionRate = totalClients > 0 ? Math.round((wonCount / totalClients) * 100) : 0

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f8]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10">

        {/* Greeting */}
        <div className="mb-8">
          <p className="text-xs font-sans text-brand-charcoal/40 uppercase tracking-widest mb-2">
            {new Date().toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">
            {greeting},{' '}
            <span className="text-brand-teal">{firstName}</span>
          </h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          <div className="col-span-2 lg:col-span-1 bg-brand-dark rounded-card p-6 flex flex-col gap-4">
            <p className="text-white/50 text-[11px] font-sans uppercase tracking-widest">Total leads</p>
            <p className="font-display text-5xl text-white font-semibold leading-none tabular-nums">{totalClients}</p>
            <div className="mt-auto pt-3 border-t border-white/10">
              <p className="text-white/30 text-xs font-sans">clientes registrados</p>
            </div>
          </div>

          <div className="bg-white rounded-card p-6 border border-brand-light-gray flex flex-col gap-3">
            <p className="text-brand-charcoal/40 text-[11px] font-sans uppercase tracking-widest">Ganados</p>
            <p className="font-display text-4xl text-brand-gold font-semibold leading-none tabular-nums">{wonCount}</p>
          </div>

          <div className="bg-white rounded-card p-6 border border-brand-light-gray flex flex-col gap-3">
            <p className="text-brand-charcoal/40 text-[11px] font-sans uppercase tracking-widest">Últimos 7 días</p>
            <p className="font-display text-4xl text-brand-teal font-semibold leading-none tabular-nums">{recentLeads?.length ?? 0}</p>
          </div>

          <div className="bg-white rounded-card p-6 border border-brand-light-gray flex flex-col gap-3">
            <p className="text-brand-charcoal/40 text-[11px] font-sans uppercase tracking-widest">Conversión</p>
            <p className="font-display text-4xl text-brand-dark font-semibold leading-none tabular-nums">
              {conversionRate}<span className="text-2xl text-brand-charcoal/25">%</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Pipeline por etapa */}
          <div className="lg:col-span-3 bg-white rounded-card border border-brand-light-gray p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-semibold font-sans text-brand-dark">Pipeline por etapa</p>
              <Link to="/pipeline" className="text-xs font-sans text-brand-teal hover:text-brand-mid font-medium">Ver pipeline →</Link>
            </div>
            {loadingStats ? (
              <div className="space-y-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-brand-light-gray animate-pulse" />
                    <div className="h-1.5 rounded-full bg-brand-light-gray animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {stageStats?.map(({ stage, count }) => {
                  const pct = totalClients > 0 ? (count / totalClients) * 100 : 0
                  return (
                    <div key={stage.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span className="text-sm font-sans text-brand-charcoal/70">{stage.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-sans text-brand-charcoal/30 tabular-nums">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold font-sans text-brand-dark tabular-nums w-5 text-right">{count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-brand-light-gray/70 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Leads recientes */}
          <div className="lg:col-span-2 bg-white rounded-card border border-brand-light-gray p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold font-sans text-brand-dark">Leads recientes</p>
              <Link to="/clients" className="text-xs font-sans text-brand-teal hover:text-brand-mid font-medium">Ver todos →</Link>
            </div>
            {loadingLeads ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-11 rounded-xl bg-brand-light-gray animate-pulse" />
                ))}
              </div>
            ) : recentLeads?.length === 0 ? (
              <p className="text-brand-charcoal/35 text-sm font-sans text-center py-8">Sin nuevos leads esta semana</p>
            ) : (
              <ul className="space-y-0.5">
                {recentLeads?.map(lead => (
                  <li key={lead.id}>
                    <Link
                      to={`/clients/${lead.id}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#f4f5f7] transition-colors group"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold font-sans"
                        style={{
                          backgroundColor: (channelColor[lead.channel] ?? '#9ca3af') + '22',
                          color: channelColor[lead.channel] ?? '#9ca3af',
                        }}
                      >
                        {(lead.full_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-brand-charcoal font-sans truncate group-hover:text-brand-teal transition-colors">
                          {lead.full_name ?? 'Sin nombre'}
                        </p>
                        <p className="text-[11px] text-brand-charcoal/40 font-sans">{channelLabel[lead.channel] ?? lead.channel}</p>
                      </div>
                      <p className="text-[11px] text-brand-charcoal/30 font-sans flex-shrink-0 tabular-nums">
                        {new Date(lead.created_at).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
