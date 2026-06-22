import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProperties, usePropertyLeadCounts } from '@/hooks/useProperties'
import type { Property } from '@/types/database'
import { STATUS_META, TYPE_LABEL, TYPE_COLOR, fmtMoney } from './propertyMeta'

type Focus = 'total' | 'available' | 'interested' | 'value'

const VIEWS: { key: Focus; emoji: string; tab: string; title: string; subtitle: string }[] = [
  { key: 'total',      emoji: '🏝️', tab: 'Resumen',     title: 'Resumen del catálogo',   subtitle: 'Todas las propiedades de Sunrise Discovery' },
  { key: 'available',  emoji: '🟢', tab: 'Disponibles', title: 'Propiedades disponibles', subtitle: 'Listas para ofrecer a tus clientes' },
  { key: 'interested', emoji: '👥', tab: 'Interesados', title: 'Leads interesados',       subtitle: 'Qué propiedades generan más demanda' },
  { key: 'value',      emoji: '💰', tab: 'Valor',       title: 'Valor del catálogo',      subtitle: 'Cómo se distribuye el valor del inventario' },
]

export function PropertyInsightsPage() {
  const { data: properties = [], isLoading } = useProperties()
  const { data: leadCounts = {} } = usePropertyLeadCounts()
  const [params] = useSearchParams()
  const focus = (VIEWS.find(v => v.key === params.get('focus'))?.key ?? 'total') as Focus
  const view = VIEWS.find(v => v.key === focus)!

  const d = useMemo(() => {
    const total = properties.length
    const available = properties.filter(p => p.status === 'available')
    const totalInterested = Object.values(leadCounts).reduce((s, n) => s + n, 0)
    const totalValue = properties.reduce((s, p) => s + (p.price_usd ?? 0), 0)
    const availableValue = available.reduce((s, p) => s + (p.price_usd ?? 0), 0)

    const byStatus = (Object.keys(STATUS_META) as Property['status'][]).map(status => {
      const list = properties.filter(p => p.status === status)
      return { status, count: list.length, value: list.reduce((s, p) => s + (p.price_usd ?? 0), 0) }
    })
    const typeCounts = (within: Property[]) =>
      (Object.keys(TYPE_LABEL) as Property['property_type'][])
        .map(type => ({ type, count: within.filter(p => p.property_type === type).length }))
        .filter(t => t.count > 0)
    const byTypeValue = (Object.keys(TYPE_LABEL) as Property['property_type'][])
      .map(type => ({ type, value: properties.filter(p => p.property_type === type).reduce((s, p) => s + (p.price_usd ?? 0), 0) }))
      .filter(t => t.value > 0)

    const ranked = [...properties]
      .map(p => ({ property: p, leads: leadCounts[p.id] ?? 0 }))
      .filter(x => x.leads > 0)
      .sort((a, b) => b.leads - a.leads)
    const withInterest = ranked.length
    const topByPrice = [...properties].filter(p => p.price_usd).sort((a, b) => (b.price_usd ?? 0) - (a.price_usd ?? 0)).slice(0, 5)

    return {
      total, available, totalInterested, totalValue, availableValue,
      byStatus, byTypeAll: typeCounts(properties), byTypeAvailable: typeCounts(available),
      byTypeValue, ranked, withInterest, topByPrice,
    }
  }, [properties, leadCounts])

  const hero: Record<Focus, { value: string; label: string; sub?: string }> = {
    total:      { value: String(d.total), label: 'propiedades en el catálogo' },
    available:  { value: String(d.available.length), label: 'disponibles', sub: d.availableValue > 0 ? `${fmtMoney(d.availableValue)} en valor disponible` : undefined },
    interested: { value: String(d.totalInterested), label: 'leads interesados', sub: `${d.withInterest} propiedad${d.withInterest !== 1 ? 'es' : ''} con interés` },
    value:      { value: d.totalValue > 0 ? fmtMoney(d.totalValue) : '—', label: 'valor total del catálogo' },
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="p-4 md:p-8 max-w-5xl mx-auto">

        {/* Botón volver */}
        <Link
          to="/properties"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-white shadow-card text-sm font-sans font-medium text-brand-dark hover:text-brand-teal transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Propiedades
        </Link>

        {/* Pestañas para saltar entre dashboards */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {VIEWS.map(v => (
            <Link
              key={v.key}
              to={`/properties/insights?focus=${v.key}`}
              className={`px-3.5 py-1.5 rounded-full text-sm font-sans font-medium transition-colors ${
                focus === v.key
                  ? 'bg-brand-teal text-white shadow-[0_4px_14px_-4px_rgba(3,165,175,0.5)]'
                  : 'bg-white text-brand-charcoal/60 hover:text-brand-dark shadow-card'
              }`}
            >
              <span className="mr-1">{v.emoji}</span>{v.tab}
            </Link>
          ))}
        </div>

        {/* Encabezado + hero */}
        <div className="mb-7">
          <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">{view.title}</h1>
          <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">{view.subtitle}</p>
        </div>

        <div className="bg-gradient-to-br from-brand-deep via-brand-dark to-[#0d3340] shadow-stat-dark rounded-card p-6 mb-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-brand-teal/25 blur-2xl" />
          <div className="flex items-center gap-2 relative">
            <span className="text-xl">{view.emoji}</span>
            <p className="text-white/70 text-xs font-sans font-bold uppercase tracking-wider">{view.tab}</p>
          </div>
          <p className="font-display text-6xl text-white leading-none tabular-nums mt-3 relative">{hero[focus].value}</p>
          <p className="text-white/55 text-sm font-sans mt-2 relative">{hero[focus].label}{hero[focus].sub ? ` · ${hero[focus].sub}` : ''}</p>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-card shadow-card p-6 h-64 animate-pulse" />
        ) : (
          renderFocus(focus, d)
        )}
      </div>
    </div>
  )
}

function renderFocus(focus: Focus, d: any): ReactNode {
  if (focus === 'total') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Por estado">
          <Bars items={d.byStatus.map((s: any) => ({ label: STATUS_META[s.status as Property['status']].label, count: s.count, color: STATUS_META[s.status as Property['status']].color, sub: s.value > 0 ? fmtMoney(s.value) : undefined }))} total={d.total} />
        </Section>
        <Section title="Por tipo">
          {d.byTypeAll.length === 0 ? <Empty text="Sin propiedades registradas." /> :
            <Bars items={d.byTypeAll.map((t: any) => ({ label: TYPE_LABEL[t.type as Property['property_type']], count: t.count, color: TYPE_COLOR[t.type as Property['property_type']] }))} total={d.total} />}
        </Section>
      </div>
    )
  }

  if (focus === 'available') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Disponibles por tipo">
          {d.byTypeAvailable.length === 0 ? <Empty text="No hay propiedades disponibles." /> :
            <Bars items={d.byTypeAvailable.map((t: any) => ({ label: TYPE_LABEL[t.type as Property['property_type']], count: t.count, color: TYPE_COLOR[t.type as Property['property_type']] }))} total={d.available.length} />}
        </Section>
        <Section title="Listado de disponibles" wide>
          {d.available.length === 0 ? <Empty text="No hay propiedades disponibles." /> :
            <PropertyList items={d.available.map((p: Property) => ({ property: p, trailing: <Price property={p} /> }))} />}
        </Section>
      </div>
    )
  }

  if (focus === 'interested') {
    return (
      <Section title="Ranking de propiedades por interesados" wide>
        {d.ranked.length === 0 ? <Empty text="Todavía no hay leads vinculados a propiedades." /> :
          <PropertyList items={d.ranked.map((x: any) => ({ property: x.property, trailing: <Interested n={x.leads} /> }))} />}
      </Section>
    )
  }

  // value
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Section title="Valor por estado">
        <Bars money items={d.byStatus.filter((s: any) => s.value > 0).map((s: any) => ({ label: STATUS_META[s.status as Property['status']].label, count: s.value, color: STATUS_META[s.status as Property['status']].color, sub: fmtMoney(s.value) }))} total={d.totalValue} />
      </Section>
      <Section title="Valor por tipo">
        {d.byTypeValue.length === 0 ? <Empty text="Sin valores registrados." /> :
          <Bars money items={d.byTypeValue.map((t: any) => ({ label: TYPE_LABEL[t.type as Property['property_type']], count: t.value, color: TYPE_COLOR[t.type as Property['property_type']], sub: fmtMoney(t.value) }))} total={d.totalValue} />}
      </Section>
      <Section title="Propiedades de mayor valor" wide>
        {d.topByPrice.length === 0 ? <Empty text="Sin precios registrados." /> :
          <PropertyList items={d.topByPrice.map((p: Property) => ({ property: p, trailing: <Price property={p} /> }))} />}
      </Section>
    </div>
  )
}

/* ---------- piezas reutilizables ---------- */

function Section({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`bg-white rounded-card shadow-card p-6 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="text-sm font-semibold font-sans text-brand-dark mb-5">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-brand-charcoal/35 text-sm font-sans text-center py-8">{text}</p>
}

function Bars({ items, total, money }: { items: { label: string; count: number; color: string; sub?: string }[]; total: number; money?: boolean }) {
  return (
    <div className="space-y-5">
      {items.map(it => {
        const pct = total > 0 ? (it.count / total) * 100 : 0
        return (
          <div key={it.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: it.color }} />
                <span className="text-sm font-sans text-brand-charcoal/70">{it.label}</span>
              </div>
              <div className="flex items-center gap-3">
                {it.sub && <span className="text-xs font-sans text-brand-charcoal/35 tabular-nums">{it.sub}</span>}
                {!money && <span className="text-sm font-semibold font-sans text-brand-dark tabular-nums w-6 text-right">{it.count}</span>}
              </div>
            </div>
            <div className="h-1.5 bg-brand-light-gray/70 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: it.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PropertyList({ items }: { items: { property: Property; trailing: ReactNode }[] }) {
  return (
    <ul className="divide-y divide-brand-light-gray">
      {items.map(({ property, trailing }) => {
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
                <span className="text-[11px] text-brand-charcoal/45 font-sans">{TYPE_LABEL[property.property_type]}</span>
              </div>
            </div>
            <div className="flex-shrink-0">{trailing}</div>
          </li>
        )
      })}
    </ul>
  )
}

function Price({ property }: { property: Property }) {
  return <span className="text-sm font-semibold font-sans text-brand-teal tabular-nums">{property.price_label ?? '—'}</span>
}

function Interested({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-1.5 text-brand-dark">
      <svg className="w-4 h-4 text-brand-teal" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="text-sm font-semibold font-sans tabular-nums">{n}</span>
    </div>
  )
}
