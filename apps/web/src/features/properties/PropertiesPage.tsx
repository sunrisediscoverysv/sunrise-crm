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

function PropertyCard({ property, leadCount }: { property: Property; leadCount: number }) {
  const status = STATUS_META[property.status]
  return (
    <div className="group bg-white rounded-card shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
      {/* Image / placeholder */}
      <div className="relative h-40 bg-gradient-to-br from-brand-dark to-brand-deep overflow-hidden">
        {property.image_url ? (
          <img src={property.image_url} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-white/25" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
            </svg>
          </div>
        )}
        <span
          className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold font-sans text-white shadow-sm"
          style={{ backgroundColor: status.color }}
        >
          {status.label}
        </span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-semibold font-sans bg-white/90 text-brand-dark backdrop-blur-sm">
          {TYPE_LABEL[property.property_type]}
        </span>
        {leadCount > 0 && (
          <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold font-sans bg-brand-dark/85 text-white backdrop-blur-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {leadCount} interesado{leadCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-lg text-brand-dark leading-snug line-clamp-2">{property.name}</h3>
        {property.location && (
          <p className="text-sm text-brand-charcoal/55 font-sans mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
              className="text-xs font-semibold font-sans text-brand-teal hover:text-brand-deep transition-colors flex items-center gap-1"
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

  return (
    <div className="h-full overflow-y-auto bg-[#f6f8f9] bg-app">
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5 md:mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-brand-dark leading-tight">Propiedades</h1>
            <p className="text-brand-charcoal/60 font-sans mt-1 text-sm">
              {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''} en el catálogo
            </p>
          </div>
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
