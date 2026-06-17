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
  web_chat: '#03a5af', other: '#8b8b8b',
}

function SunriseHero({ greeting, firstName, dateStr }: { greeting: string; firstName: string; dateStr: string }) {
  const sunX = 720
  const sunY = 310

  return (
    <div className="relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #071928 0%, #0b2e43 30%, #0f3a52 65%, #0d3c52 100%)',
      paddingTop: '2.5rem',
      paddingBottom: '7.5rem',
    }}>

      {/* Golden horizon glow */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '260px',
        background: 'radial-gradient(ellipse 65% 100% at 50% 100%, rgba(238,187,105,0.42) 0%, rgba(238,187,105,0.14) 42%, transparent 68%)',
      }} />

      {/* Teal ocean surface reflection */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: '180px',
        background: 'radial-gradient(ellipse 90% 80% at 50% 100%, rgba(3,165,175,0.18) 0%, transparent 60%)',
      }} />

      {/* Light rays from sun */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 280"
        preserveAspectRatio="xMidYMax meet"
      >
        {Array.from({ length: 11 }).map((_, i) => {
          const halfSpread = 58
          const step = (halfSpread * 2) / 10
          const angleDeg = -halfSpread + i * step
          const angle = angleDeg * (Math.PI / 180)
          const len = 310
          const hw = 0.038
          const ax = sunX + Math.sin(angle - hw) * len
          const ay = sunY - Math.cos(angle - hw) * len
          const bx = sunX + Math.sin(angle + hw) * len
          const by = sunY - Math.cos(angle + hw) * len
          const opacity = (1 - Math.abs(angleDeg) / halfSpread) * 0.072
          return (
            <polygon
              key={i}
              points={`${sunX},${sunY} ${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`}
              fill={`rgba(238,187,105,${opacity.toFixed(3)})`}
            />
          )
        })}
      </svg>

      {/* Horizon shimmer line */}
      <div className="absolute left-0 right-0 pointer-events-none" style={{
        bottom: '78px',
        height: '1px',
        background: 'linear-gradient(90deg, transparent 5%, rgba(238,187,105,0.45) 18%, rgba(255,230,100,0.8) 50%, rgba(238,187,105,0.45) 82%, transparent 95%)',
      }} />

      {/* Sun — half circle above horizon */}
      <div className="absolute left-1/2 pointer-events-none" style={{
        bottom: '76px',
        transform: 'translateX(-50%)',
        width: '52px',
        height: '26px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 65%, #fff4a0 0%, #ffd64a 30%, #f5a800 60%, #e07800 85%, transparent 100%)',
          boxShadow: '0 0 28px 10px rgba(238,187,105,0.5)',
        }} />
      </div>

      {/* Ocean wave SVG */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg
          viewBox="0 0 1440 80"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '80px', display: 'block' }}
        >
          {/* Teal ocean wave */}
          <path
            d="M0,44 C200,20 400,62 600,42 C800,22 1000,56 1200,38 C1310,28 1380,46 1440,40 L1440,80 L0,80 Z"
            fill="rgba(3,165,175,0.22)"
          />
          {/* Content background wave */}
          <path
            d="M0,60 C240,36 480,70 720,54 C960,38 1200,64 1440,56 L1440,80 L0,80 Z"
            fill="#eef0f3"
          />
        </svg>
      </div>

      {/* Text content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10">
        <p className="text-white/30 text-xs font-sans capitalize tracking-[0.12em] mb-3">{dateStr}</p>
        <h1 className="font-display text-3xl md:text-[2.75rem] text-white leading-tight mb-1.5">
          {greeting},{' '}
          <em className="not-italic" style={{ color: '#ffd64a' }}>{firstName}</em>
        </h1>
        <p className="text-white/35 font-sans text-sm">Resumen de tu pipeline de ventas</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const { data: stageStats, isLoading: loadingStats } = useStageStats()
  const { data: recentLeads, isLoading: loadingLeads } = useRecentLeads()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const dateStr = now.toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const firstName = profile?.full_name?.split(' ')[0] ?? 'equipo'

  const totalClients = stageStats?.reduce((s, { count }) => s + count, 0) ?? 0
  const wonCount = stageStats?.find(({ stage }) => stage.is_won)?.count ?? 0
  const conversionRate = totalClients > 0 ? Math.round((wonCount / totalClients) * 100) : 0

  return (
    <div className="h-full overflow-y-auto bg-[#eef0f3]">

      <SunriseHero greeting={greeting} firstName={firstName} dateStr={dateStr} />

      {/* Stat cards — overlap the wave */}
      <div className="px-4 md:px-8 -mt-16 pb-8">
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">

            {/* Total leads — featured */}
            <div
              className="col-span-2 lg:col-span-1 rounded-card p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #03a5af 0%, #065f6a 100%)',
                boxShadow: '0 16px 48px -8px rgba(3,165,175,0.45), 0 4px 12px -4px rgba(0,0,0,0.15)',
              }}
            >
              <div className="absolute -bottom-5 -right-5 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
              <p className="text-white/50 text-[10px] font-sans uppercase tracking-[0.2em] mb-4">Total leads</p>
              <p className="font-display text-5xl text-white font-semibold leading-none tabular-nums">{totalClients}</p>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/15">
                <svg className="w-3 h-3 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-white/40 text-[11px] font-sans">clientes activos</p>
              </div>
            </div>

            {/* Ganados */}
            <div className="bg-white rounded-card p-5 shadow-[0_8px_36px_-8px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-brand-charcoal/40 text-[10px] font-sans uppercase tracking-[0.2em]">Ganados</p>
                <div className="w-6 h-6 rounded-lg bg-brand-gold/15 flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-gold" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              </div>
              <p className="font-display text-4xl text-brand-gold font-semibold leading-none tabular-nums">{wonCount}</p>
            </div>

            {/* Últimos 7 días */}
            <div className="bg-white rounded-card p-5 shadow-[0_8px_36px_-8px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-brand-charcoal/40 text-[10px] font-sans uppercase tracking-[0.2em]">7 días</p>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="font-display text-4xl text-emerald-600 font-semibold leading-none tabular-nums">{recentLeads?.length ?? 0}</p>
            </div>

            {/* Conversión */}
            <div className="bg-white rounded-card p-5 shadow-[0_8px_36px_-8px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-brand-charcoal/40 text-[10px] font-sans uppercase tracking-[0.2em]">Conversión</p>
                <div className="w-6 h-6 rounded-lg bg-brand-dark/10 flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-dark" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <p className="font-display text-4xl text-brand-dark font-semibold leading-none tabular-nums">
                {conversionRate}<span className="text-2xl text-brand-charcoal/25">%</span>
              </p>
            </div>
          </div>

          {/* Pipeline por etapa */}
          <div className="bg-white rounded-card border border-black/[0.05] p-5 md:p-6 mb-5 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-semibold font-sans text-brand-dark">Pipeline por etapa</p>
              <Link to="/pipeline" className="text-xs font-sans text-brand-teal hover:text-brand-mid font-medium">
                Ver pipeline →
              </Link>
            </div>
            {loadingStats ? (
              <div className="flex flex-col gap-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-brand-light-gray animate-pulse" />
                    <div className="h-1.5 rounded-full bg-brand-light-gray animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {stageStats?.map(({ stage, count }) => {
                  const pct = totalClients > 0 ? (count / totalClients) * 100 : 0
                  return (
                    <div key={stage.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                          <span className="text-sm font-sans text-brand-charcoal/75 font-medium">{stage.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-sans text-brand-charcoal/30 tabular-nums">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold font-sans text-brand-dark w-5 text-right tabular-nums">{count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-brand-light-gray/60 rounded-full overflow-hidden">
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
          <div className="bg-white rounded-card border border-black/[0.05] p-5 md:p-6 shadow-card">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold font-sans text-brand-dark">Leads recientes</p>
              <Link to="/clients" className="text-xs font-sans text-brand-teal hover:text-brand-mid font-medium">
                Ver todos →
              </Link>
            </div>
            {loadingLeads ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-brand-light-gray animate-pulse" />
                ))}
              </div>
            ) : recentLeads?.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 rounded-2xl bg-brand-light-gray/60 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-brand-charcoal/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-brand-charcoal/35 text-sm font-sans">Sin nuevos leads en los últimos 7 días</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {recentLeads?.map(lead => (
                  <li key={lead.id}>
                    <Link
                      to={`/clients/${lead.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f4f5f7] transition-colors group"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold font-sans"
                        style={{
                          backgroundColor: (channelColor[lead.channel] ?? '#8b8b8b') + '22',
                          color: channelColor[lead.channel] ?? '#8b8b8b',
                        }}
                      >
                        {(lead.full_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-charcoal font-sans truncate group-hover:text-brand-teal transition-colors">
                          {lead.full_name ?? 'Sin nombre'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: channelColor[lead.channel] ?? '#8b8b8b' }} />
                          <p className="text-xs text-brand-charcoal/40 font-sans">{channelLabel[lead.channel] ?? lead.channel}</p>
                        </div>
                      </div>
                      <p className="text-xs text-brand-charcoal/30 font-sans flex-shrink-0 tabular-nums">
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
