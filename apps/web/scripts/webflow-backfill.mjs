// =============================================================================
// Relleno único: sincroniza TODAS las propiedades del CMS de Webflow al CRM.
//
// Lee los ítems vía la Data API de Webflow y los reenvía a la misma Edge Function
// `webflow-webhook`, así reutiliza exactamente el mapeo ya validado (imágenes,
// precio, ubicación, etc.). No escribe directo a Supabase.
//
// Uso:
//   WEBFLOW_API_TOKEN=xxx WEBFLOW_WEBHOOK_SECRET=yyy node scripts/webflow-backfill.mjs
//
// Opcional (si el autodetección de colección falla):
//   WEBFLOW_COLLECTION_ID=zzz ...
//
// Sin dependencias externas — requiere Node 20+ (fetch global).
// =============================================================================

const TOKEN = process.env.WEBFLOW_API_TOKEN
const SECRET = process.env.WEBFLOW_WEBHOOK_SECRET
const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID || null
const WEBHOOK_URL = process.env.WEBFLOW_WEBHOOK_URL ||
  'https://hossxvizztnvldoibnrh.supabase.co/functions/v1/webflow-webhook'

if (!TOKEN || !SECRET) {
  console.error('Faltan variables: WEBFLOW_API_TOKEN y WEBFLOW_WEBHOOK_SECRET')
  process.exit(1)
}

const wf = (path) =>
  fetch(`https://api.webflow.com/v2${path}`, {
    headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Webflow ${path} → ${r.status} ${await r.text()}`)
    return r.json()
  })

// ── 1. Encontrar la colección de propiedades ──────────────────────────────────
async function findCollectionId() {
  if (COLLECTION_ID) return COLLECTION_ID
  const { sites } = await wf('/sites')
  for (const site of sites) {
    const { collections } = await wf(`/sites/${site.id}/collections`)
    console.log(`Sitio "${site.displayName}" → colecciones: ${collections.map((c) => c.displayName).join(', ')}`)
    const match = collections.find((c) =>
      /propert|propiedad/i.test(`${c.displayName} ${c.slug}`)
    )
    if (match) {
      console.log(`→ Usando colección "${match.displayName}" (${match.id})`)
      return match.id
    }
  }
  throw new Error('No encontré una colección de propiedades. Pásala con WEBFLOW_COLLECTION_ID=...')
}

// ── 2. Listar todos los ítems (paginado) ──────────────────────────────────────
async function listItems(collectionId) {
  const all = []
  let offset = 0
  const limit = 100
  for (;;) {
    const data = await wf(`/collections/${collectionId}/items?limit=${limit}&offset=${offset}`)
    all.push(...data.items)
    const total = data.pagination?.total ?? all.length
    offset += limit
    if (offset >= total || data.items.length === 0) break
  }
  return all
}

// ── 3. Reenviar cada ítem al webhook ──────────────────────────────────────────
async function pushToWebhook(item) {
  const res = await fetch(`${WEBHOOK_URL}?secret=${encodeURIComponent(SECRET)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ triggerType: 'collection_item_changed', payload: item }),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const main = async () => {
  const collectionId = await findCollectionId()
  const items = await listItems(collectionId)
  console.log(`\nEncontradas ${items.length} propiedades en Webflow. Sincronizando...\n`)

  let ok = 0
  let fail = 0
  for (const item of items) {
    const slug = item.fieldData?.slug ?? item.slug ?? '(sin slug)'
    const { status, body } = await pushToWebhook(item)
    if (status === 200) {
      ok++
      console.log(`  ✓ ${slug} → ${body.action ?? 'ok'}`)
    } else {
      fail++
      console.log(`  ✗ ${slug} → HTTP ${status} ${JSON.stringify(body)}`)
    }
  }

  console.log(`\nListo. ${ok} sincronizadas, ${fail} con error.`)
}

main().catch((e) => {
  console.error('\nError:', e.message)
  process.exit(1)
})
