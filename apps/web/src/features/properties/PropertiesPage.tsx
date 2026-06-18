import { useState, useMemo } from 'react'
import { useProperties, usePropertyLeadCounts } from '@/hooks/useProperties'
import { EmptyState } from '@/components/EmptyState'
import type { Property } from '@/types/database'

const STATUS_META: Record<Property['status'], { label: string; color: string }> = {
  available:  { label: 'Disponible', color: '#03a5af' },
  reserved:   { label: 'Reservada',  color: '#eebb69' },
  sold:       { label: 'Vendida',    color: '#6b7280' },
  off_market: { label: 'Fuera de mercado', color: '#9ca3af' },
}

const TYPE_LABEL: Record<Property['property_type'], string> = {
  land: 'Terreno', house: 'Casa', department: 'Apartamento', lot: 'Lote', other: 'Otro',
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function PropertyCard({ property, leadCount }: { property: Property; leadCount: number }) {
  const status = STATUS_META[property.status]
  return (
    <div className="group bg-white rounded-card shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
      {/* Accent bar por estado */}
      <div className="h-1.5 w-full" style={{ backgroundColor: status.color }} />

      {/* Imagen / placeholder */}
      <div className="relative h-40 bg-gradient-to-br from-brand-dark via-brand-deep to-brand-mid overflow-hidden">
        {property.image_url ? (
          <img src={property.image_url} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
            </svg>
          </div>
        )}
        <span
          className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold font-sans text-white shadow-sm"
          style={{ backgroundColor: status.color }}
        >
          {status.label}
        </span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold font-sans bg-white/90 text-brand-dark backdrop-blur-sm">
          {TYPE_LABEL[property.property_type]}
        </span>
        {leadCount > 0 && (
          <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold font-sans bg-brand-dark/85 text-white backdrop-blur-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {leadCount} interesado{leadCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-lg text-brand-dark leading-snug line-clamp-2">{property.name}</h3>
        {property.location && (
          <p className="text-sm text-brand-charcoal/55 font-sans mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-brand-teal" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="line-clamp-1">{property.location}</span>
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-brand-light-gray flex items-end justify-between">
          <div>
            <p className="font-display text-2xl text-brand-teal leading-none">{property.price_label ?? '—'}</p>
            {property.size_label && (
              <p className="text-xs text-brand-charcoal/45 font-sans mt-1.5">{property.size_label}</p>
            )}
          </div>
          {property.source_url && (
            <a
              href={property.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold font-sans text-brand-teal hover:text-brand-deep transition-colors flex items-center gap-1"
            >
              Ver sitio
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function PropertiesPage() {
  const { data: properties = [], isLoading } = useProperties()
  const { data: leadCounts = {} } = usePropertyLeadCounts()
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = useMemo(
    () =>
      properties.filter(
        p =>
          (!typeFilter || p.property_type === typeFilter) &&
          (!statusFilter || p.status === statusFilter),
      ),
    [properties, typeFilter, statusFilter],
  )

  const types = Array.from(new Set(properties.map(p => p.property_type)))

  // Métricas para los bloques de color
  const available = properties.filter(p => p.status === 'available').length
  const totalInterested = Object.values(leadCounts).reduce((s, n) => s + n, 0)
  const totalValue = properties.reduce((s, p) => s + (p.price_usd ?? 0), 0)

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Propiedades</h1>
          <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">Catálogo de Sunrise Discovery</p>
        </div>

        {/* Bloques de color tipo Monday */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <div className="bg-gradient-to-br from-brand-deep via-brand-dark to-[#0d3340] shadow-stat-dark rounded-card p-5 relative overflow-hidden hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-brand-teal/25 blur-2xl" />
            <div className="flex items-center gap-2 relative"><span className="text-lg">🏝️</span><p className="text-white/70 text-[11px] font-sans font-bold uppercase tracking-wider">Propiedades</p></div>
            <p className="font-display text-4xl text-white leading-none tabular-nums mt-3 relative">{properties.length}</p>
          </div>
          <div className="bg-brand-teal shadow-stat-teal rounded-card p-5 relative overflow-hidden hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -bottom-6 -right-4 w-24 h-24 rounded-full bg-white/20 blur-xl" />
            <div className="flex items-center gap-2 relative"><span className="text-lg">🟢</span><p className="text-white/80 text-[11px] font-sans font-bold uppercase tracking-wider">Disponibles</p></div>
            <p className="font-display text-4xl text-white leading-none tabular-nums mt-3 relative">{available}</p>
          </div>
          <div className="bg-brand-gold shadow-stat-gold rounded-card p-5 relative overflow-hidden hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -bottom-6 -right-4 w-24 h-24 rounded-full bg-white/25 blur-xl" />
            <div className="flex items-center gap-2 relative"><span className="text-lg">👥</span><p className="text-brand-dark/70 text-[11px] font-sans font-bold uppercase tracking-wider">Leads interesados</p></div>
            <p className="font-display text-4xl text-brand-dark leading-none tabular-nums mt-3 relative">{totalInterested}</p>
          </div>
          <div className="bg-brand-deep shadow-card rounded-card p-5 relative overflow-hidden hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -bottom-6 -right-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
            <div className="flex items-center gap-2 relative"><span className="text-lg">💰</span><p className="text-white/70 text-[11px] font-sans font-bold uppercase tracking-wider">Valor catálogo</p></div>
            <p className="font-display text-4xl text-white leading-none tabular-nums mt-3 relative">{totalValue > 0 ? fmtMoney(totalValue) : '—'}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <p className="text-sm font-sans font-semibold text-brand-charcoal/60">
            {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="text-sm px-3 py-2 rounded-button border border-brand-light-gray font-sans text-brand-charcoal/70 bg-white focus:outline-none focus:border-brand-teal/50"
            >
              <option value="">Todos los tipos</option>
              {types.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm px-3 py-2 rounded-button border border-brand-light-gray font-sans text-brand-charcoal/70 bg-white focus:outline-none focus:border-brand-teal/50"
            >
              <option value="">Todos los estados</option>
              {(Object.keys(STATUS_META) as Property['status'][]).map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-card shadow-card overflow-hidden">
                <div className="h-40 bg-brand-light-gray animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 bg-brand-light-gray rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-brand-light-gray rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-card shadow-card">
            <EmptyState
              icon={
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
                </svg>
              }
              title="Sin propiedades"
              description="No hay propiedades para los filtros aplicados."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => <PropertyCard key={p.id} property={p} leadCount={leadCounts[p.id] ?? 0} />)}
          </div>
        )}
      </div>
    </div>
  )
}
