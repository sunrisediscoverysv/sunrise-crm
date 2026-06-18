import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

// ─────────────────────────────────────────────────────────────────────────────
// Webflow → CRM sync
//
// Recibe los webhooks de CMS de Webflow (collection_item_created / _changed /
// _deleted / _unpublished) y mantiene la tabla `properties` sincronizada.
//
// Webflow NO permite añadir headers personalizados a los webhooks creados desde
// el dashboard, así que el secreto viaja como query param: ?secret=XXX
// (también se acepta el header x-webhook-secret por si se crea el webhook vía API).
//
// IMPORTANTE — mapeo de campos:
// `payload.fieldData` usa los SLUGS de los campos de tu colección en Webflow.
// Abajo, FIELD_MAP lista los candidatos por cada columna del CRM. Si tus campos
// en Webflow tienen otros slugs, añádelos a la lista correspondiente (o ajusta
// vía las variables WEBFLOW_FIELD_* descritas en cada entrada).
// ─────────────────────────────────────────────────────────────────────────────

interface WebflowPayload {
  triggerType?: string
  payload?: {
    id?: string
    slug?: string
    isArchived?: boolean
    isDraft?: boolean
    fieldData?: Record<string, unknown>
    // formato legacy (webhooks v1): los campos vienen en la raíz
    [key: string]: unknown
  }
  // formato legacy v1: a veces el item llega directo en la raíz
  [key: string]: unknown
}

type Status = 'available' | 'reserved' | 'sold' | 'off_market'
type PropertyType = 'land' | 'house' | 'department' | 'lot' | 'other'

// Candidatos de slug por cada columna del CRM. Se toma el primero que exista.
// Mapeado a la colección real de Sunrise (Webflow → "Property Settings").
// Nota: "Loaction" tiene el typo tal cual está en Webflow.
const FIELD_MAP: Record<string, string[]> = {
  name:        ['name'],
  location:    ['location-main', 'loaction'],
  price_label: ['price', 'price-per-vara'],
  size_label:  ['land-area', 'land-area-2', 'm2-total', 'size-sq-ft'],
  image_url:   ['property-img-1', 'property-img-2', 'property-img-3'],
  description: ['summary'],
  property_type: ['property-type', 'types-select'],
  status:      ['status', 'availability'], // tu colección no tiene este campo → default 'available'
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Lee el primer campo presente entre los candidatos.
function pick(data: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (data[k] != null && data[k] !== '') return data[k]
  }
  return null
}

// Normaliza un valor de campo a texto. Webflow devuelve imágenes como objeto { url }.
function asText(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.url === 'string') return o.url            // imagen / file
    if (typeof o.name === 'string') return o.name          // referencia / option
  }
  return null
}

// Formatea la etiqueta de precio para mostrar. Si empieza con número, le antepone
// "$" y normaliza la unidad por vara ("65 /v²" → "$65/v²"). Si ya trae "$", la deja.
function formatPriceLabel(label: string | null): string | null {
  if (!label) return null
  const t = label.trim()
  if (t.startsWith('$')) return t
  if (/^[\d.,]/.test(t)) return `$${t.replace(/\s*\/\s*/, '/')}`
  return t
}

// Extrae un valor USD absoluto desde una etiqueta de precio ("$420,000", "$100/v²").
// Devuelve null si es un precio por unidad (contiene "/").
function parsePriceUsd(label: string | null): number | null {
  if (!label) return null
  if (label.includes('/')) return null
  const digits = label.replace(/[^0-9.]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

function mapPropertyType(v: string | null): PropertyType {
  const s = (v ?? '').toLowerCase()
  if (s.includes('hous') || s.includes('casa')) return 'house'
  if (s.includes('apart') || s.includes('depart')) return 'department'
  if (s.includes('lot') || s.includes('lote')) return 'lot'
  if (s.includes('land') || s.includes('terreno')) return 'land'
  if (s) return 'other'
  return 'land'
}

function mapStatus(v: string | null): Status {
  const s = (v ?? '').toLowerCase()
  if (s.includes('reserv')) return 'reserved'
  if (s.includes('sold') || s.includes('vend')) return 'sold'
  if (s.includes('off') || s.includes('fuera') || s.includes('unavail')) return 'off_market'
  return 'available'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── Autenticación por secreto (query param ?secret= o header x-webhook-secret) ──
  const webhookSecret = Deno.env.get('WEBFLOW_WEBHOOK_SECRET')
  const url = new URL(req.url)
  const incomingSecret = url.searchParams.get('secret') ?? req.headers.get('x-webhook-secret') ?? ''

  if (!webhookSecret || !timingSafeEqual(incomingSecret, webhookSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: WebflowPayload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Webflow v2 envuelve el item en `payload`; v1 lo manda en la raíz.
  const item = (body.payload ?? body) as WebflowPayload['payload'] & Record<string, unknown>
  const triggerType = body.triggerType ?? ''
  const fieldData: Record<string, unknown> =
    (item?.fieldData as Record<string, unknown>) ?? (item as Record<string, unknown>) ?? {}

  // Log de los slugs recibidos — útil para verificar el mapeo en la primera prueba.
  console.log(`[webflow] campos recibidos: ${Object.keys(fieldData).join(', ')}`)

  // slug puede venir en fieldData.slug, item.slug, o como propiedad raíz
  const slug = asText(pick(fieldData, ['slug'])) ?? asText(item?.slug) ?? null

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug in payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // ── Eliminado / despublicado → marcar fuera de mercado (no se borra el lead vinculado) ──
  if (triggerType.includes('deleted') || triggerType.includes('unpublished')) {
    const { error } = await supabase
      .from('properties')
      .update({ status: 'off_market' as Status })
      .eq('slug', slug)
    if (error) console.error('Error marking off_market:', error)
    console.log(`[webflow] ${triggerType} → ${slug} marcada off_market`)
    return new Response(JSON.stringify({ ok: true, slug, action: 'off_market' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Si el item está archivado o en borrador, no lo publicamos como disponible.
  const isHidden = item?.isArchived === true || item?.isDraft === true

  const name = asText(pick(fieldData, FIELD_MAP.name)) ?? slug
  const rawPrice = asText(pick(fieldData, FIELD_MAP.price_label))
  const priceLabel = formatPriceLabel(rawPrice)
  const explicitStatus = asText(pick(fieldData, FIELD_MAP.status))

  const row = {
    name,
    slug,
    location: asText(pick(fieldData, FIELD_MAP.location)),
    property_type: mapPropertyType(asText(pick(fieldData, FIELD_MAP.property_type))),
    price_label: priceLabel,
    price_usd: parsePriceUsd(priceLabel),
    size_label: asText(pick(fieldData, FIELD_MAP.size_label)),
    status: (isHidden ? 'off_market' : mapStatus(explicitStatus)) as Status,
    description: asText(pick(fieldData, FIELD_MAP.description)),
    image_url: asText(pick(fieldData, FIELD_MAP.image_url)),
    source_url: `https://sunrisediscovery.com/properties/${slug}`,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('properties')
    .upsert(row, { onConflict: 'slug' })

  if (error) {
    console.error('Error upserting property:', error)
    return new Response(JSON.stringify({ error: 'Failed to upsert property' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[webflow] ${triggerType || 'sync'} → ${slug} (${row.status})`)
  return new Response(JSON.stringify({ ok: true, slug, action: 'upsert' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
