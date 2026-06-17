import { useQuery } from '@tanstack/react-query'
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

export function DashboardPage() {
  const { profile } = useAuth()
  const { data: stageStats, isLoading: loadingStats } = useStageStats()
  const { data: recentLeads, isLoading: loadingLeads } = useRecentLeads()

  const totalClients = stageStats?.reduce((s, { count }) => s + count, 0) ?? 0
  const wonCount = stageStats?.find(({ stage }) => stage.is_won)?.count ?? 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="font-display text-2xl md:text-3xl text-brand-dark">
            Buen día, {profile?.full_name?.split(' ')[0] ?? 'equipo'}
          </h1>
          <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">Resumen del pipeline de ventas</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-brand-dark rounded-card p-4 md:p-5 col-span-2 md:col-span-1">
            <p className="text-white/60 text-sm font-sans mb-2 md:mb-3">Total clientes</p>
            <p className="text-3xl md:text-4xl font-display font-semibold text-white">{totalClients}</p>
          </div>
          <div className="bg-white rounded-card p-4 md:p-5 border border-brand-light-gray">
            <p className="text-brand-charcoal/60 text-sm font-sans mb-2 md:mb-3">Cerrados ganados</p>
            <p className="text-2xl md:text-3xl font-display font-semibold text-brand-teal">{wonCount}</p>
          </div>
          <div className="bg-white rounded-card p-4 md:p-5 border border-brand-light-gray col-span-2">
            <p className="text-brand-charcoal/60 text-sm font-sans mb-2 md:mb-3">Nuevos leads (últimos 7 días)</p>
            <p className="text-2xl md:text-3xl font-display font-semibold text-brand-dark">{recentLeads?.length ?? 0}</p>
          </div>
        </div>

        {/* Stage breakdown */}
        <div className="bg-white rounded-card border border-brand-light-gray p-4 md:p-6 mb-6 md:mb-8">
          <h2 className="font-display text-lg md:text-xl text-brand-dark mb-4 md:mb-5">Clientes por etapa</h2>
          {loadingStats ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 rounded-full bg-brand-light-gray animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {stageStats?.map(({ stage, count }) => {
                const pct = totalClients > 0 ? (count / totalClients) * 100 : 0
                return (
                  <div key={stage.id} className="flex items-center gap-2 md:gap-4">
                    <span className="text-xs md:text-sm font-sans text-brand-charcoal/70 w-28 sm:w-36 md:w-48 truncate flex-shrink-0">
                      {stage.name}
                    </span>
                    <div className="flex-1 h-2 bg-brand-light-gray rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <span className="text-sm font-medium font-sans text-brand-charcoal w-6 text-right flex-shrink-0">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent leads */}
        <div className="bg-white rounded-card border border-brand-light-gray p-4 md:p-6">
          <h2 className="font-display text-lg md:text-xl text-brand-dark mb-4 md:mb-5">Leads recientes (7 días)</h2>
          {loadingLeads ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-brand-light-gray animate-pulse" />
              ))}
            </div>
          ) : recentLeads?.length === 0 ? (
            <p className="text-brand-charcoal/40 text-sm font-sans py-6 text-center">
              Sin nuevos leads en los últimos 7 días
            </p>
          ) : (
            <ul className="divide-y divide-brand-light-gray">
              {recentLeads?.map(lead => (
                <li key={lead.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-charcoal font-sans truncate">
                      {lead.full_name ?? 'Sin nombre'}
                    </p>
                    <p className="text-xs text-brand-charcoal/50 font-sans">
                      {channelLabel[lead.channel] ?? lead.channel}
                    </p>
                  </div>
                  <p className="text-xs text-brand-charcoal/40 font-sans flex-shrink-0">
                    {new Date(lead.created_at).toLocaleDateString('es-SV')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
