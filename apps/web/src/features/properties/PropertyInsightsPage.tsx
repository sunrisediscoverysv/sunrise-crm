import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProperties, usePropertyLeadCounts } from '@/hooks/useProperties'
import type { Property } from '@/types/database'
import { STATUS_META, TYPE_LABEL, TYPE_COLOR, fmtMoney } from './propertyMeta'

type Focus = 'total' | 'available' | 'interested' | 'value'

export function PropertyInsightsPage() {
  const { data: properties = [], isLoading } = useProperties()
  const { data: leadCounts = {} } = usePropertyLeadCounts()
  const [params] = useSearchParams()
  const focus = (params.get('focus') ?? 'total') as Focus

  const stats = useMemo(() => {
    const total = properties.length
    const available = properties.filter(p => p.status === 'available').length
    const totalInterested = Object.values(leadCounts).reduce((s, n) => s + n, 0)
    const totalValue = properties.reduce((s, p) => s + (p.price_usd ?? 0), 0)

    const byStatus = (Object.keys(STATUS_META) as Property['status'][]).map(status => ({
      status,
      count: properties.filter(p => p.status === status).length,
      value: properties.filter(p => p.status === status).reduce((s, p) => s + (p.price_usd ?? 0), 0),
    }))

    const byType = (Object.keys(TYPE_LABEL) as Property['property_type'][])
      .map(type => ({ type, count: properties.filter(p => p.property_type === type).length }))
      .filter(t => t.count > 0)

    const topByInterest = [...properties]
      .map(p => ({ property: p, leads: leadCounts[p.id] ?? 0 }))
      .filter(x => x.leads > 0)
      .sort((a, b) => b.leads - a.leads)

    return { total, available, totalInterested, totalValue, byStatus, byType, topByInterest }
  }, [properties, leadCounts])

  const cards: { key: Focus; emoji: string; label: string; value: string; bg: string; text: string }[] = [
    { key: 'total',      emoji: '🏝️', label: 'Propiedades',      value: String(stats.total),       bg: 'bg-gradient-to-br from-brand-deep via-brand-dark to-[#0d3340]', text: 'text-white' },
    { key: 'available',  emoji: '🟢', label: 'Disponibles',       value: String(stats.available),   bg: 'bg-brand-teal', text: 'text-white' },
    { key: 'interested', emoji: '👥', label: 'Leads interesados', value: String(stats.totalInterested), bg: 'bg-brand-gold', text: 'text-brand-dark' },
    { key: 'value',      emoji: '💰', label: 'Valor catálogo',    value: stats.totalValue > 0 ? fmtMoney(stats.totalValue) : '—', bg: 'bg-brand-deep', text: 'text-white' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="p-4 md:p-8 max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <Link to="/properties" className="inline-flex items-center gap-1.5 text-sm font-sans text-brand-teal hover:text-brand-deep transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Propiedades
          </Link>
          <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Detalle de propiedades</h1>
          <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">Desglose del catálogo de Sunrise Discovery</p>
        </div>

        {/* Tarjetas de resumen (la enfocada se resalta) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {cards.map(c => (
            <div
              key={c.key}
              className={`${c.bg} rounded-card p-5 relative overflow-hidden shadow-card transition-all duration-300 ${
                focus === c.key ? 'ring-2 ring-brand-teal ring-offset-2 scale-[1.02]' : ''
              }`}
            >
              <div className="absolute -bottom-6 -right-4 w-24 h-24 rounded-full bg-white/15 blur-xl" />
              <div className="flex items-center gap-2 relative">
                <span className="text-lg">{c.emoji}</span>
                <p className={`${c.text} text-[11px] font-sans font-bold uppercase tracking-wider opacity-80`}>{c.label}</p>
              </div>
              <p className={`font-display text-4xl ${c.text} leading-none tabular-nums mt-3 relative`}>{c.value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-6 h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Por estado */}
            <section className="bg-white rounded-card shadow-card p-6">
              <h2 className="text-sm font-semibold font-sans text-brand-dark mb-5">Por estado</h2>
              <div className="space-y-5">
                {stats.byStatus.map(({ status, count, value }) => {
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                  const meta = STATUS_META[status]
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                          <span className="text-sm font-sans text-brand-charcoal/70">{meta.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {value > 0 && <span className="text-xs font-sans text-brand-charcoal/35 tabular-nums">{fmtMoney(value)}</span>}
                          <span className="text-sm font-semibold font-sans text-brand-dark tabular-nums w-6 text-right">{count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-brand-light-gray/70 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Por tipo */}
            <section className="bg-white rounded-card shadow-card p-6">
              <h2 className="text-sm font-semibold font-sans text-brand-dark mb-5">Por tipo</h2>
              {stats.byType.length === 0 ? (
                <p className="text-brand-charcoal/35 text-sm font-sans text-center py-8">Sin propiedades registradas.</p>
              ) : (
                <div className="space-y-5">
                  {stats.byType.map(({ type, count }) => {
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[type] }} />
                            <span className="text-sm font-sans text-brand-charcoal/70">{TYPE_LABEL[type]}</span>
                          </div>
                          <span className="text-sm font-semibold font-sans text-brand-dark tabular-nums w-6 text-right">{count}</span>
                        </div>
                        <div className="h-1.5 bg-brand-light-gray/70 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: TYPE_COLOR[type] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Propiedades con más interesados */}
            <section className="bg-white rounded-card shadow-card p-6 lg:col-span-2">
              <h2 className="text-sm font-semibold font-sans text-brand-dark mb-5">Propiedades con más interesados</h2>
              {stats.topByInterest.length === 0 ? (
                <p className="text-brand-charcoal/35 text-sm font-sans text-center py-8">Todavía no hay leads vinculados a propiedades.</p>
              ) : (
                <ul className="divide-y divide-brand-light-gray">
                  {stats.topByInterest.map(({ property, leads }) => {
                    const meta = STATUS_META[property.status]
                    return (
                      <li key={property.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="w-11 h-11 rounded-lg bg-brand-light-gray/60 overflow-hidden flex-shrink-0">
                          {property.image_url ? (
                            <img src={property.image_url} alt={property.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brand-charcoal/25">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-charcoal font-sans truncate">{property.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: meta.color + '1f', color: meta.color }}>{meta.label}</span>
                            {property.price_label && <span className="text-[11px] text-brand-charcoal/45 font-sans">{property.price_label}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-brand-dark">
                          <svg className="w-4 h-4 text-brand-teal" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm font-semibold font-sans tabular-nums">{leads}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
