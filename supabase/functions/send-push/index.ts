import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.3.0'

// Web Push nativo de Deno (web-push de npm no corre en el runtime de Supabase).
// Convierte las llaves VAPID base64url (formato web-push) a JWK para importarlas.

function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}
function bytesToB64url(b: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('PUSH_SECRET')
  if (!secret || req.headers.get('x-push-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    let title = 'Sunrise CRM'
    let message = ''
    let url = '/'
    const record = (body as { record?: Record<string, unknown> }).record
    if (record) {
      const name = (record.full_name as string) ?? 'Sin nombre'
      const channel = (record.channel as string) ?? ''
      title = '🎯 Nuevo lead'
      message = channel ? `${name} · ${channel}` : name
      url = `/clients/${record.id}`
    } else {
      title = (body as { title?: string }).title ?? title
      message = (body as { body?: string }).body ?? ''
      url = (body as { url?: string }).url ?? '/'
    }

    // VAPID base64url → JWK
    const pub = b64urlToBytes(Deno.env.get('VAPID_PUBLIC_KEY') ?? '')
    const x = bytesToB64url(pub.slice(1, 33))
    const y = bytesToB64url(pub.slice(33, 65))
    const d = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

    const vapidKeys = await webpush.importVapidKeys({
      publicKey: { kty: 'EC', crv: 'P-256', x, y },
      privateKey: { kty: 'EC', crv: 'P-256', x, y, d },
    }, { extractable: false })

    const appServer = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@sunrisediscovery.com',
      vapidKeys,
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    const { data: subs } = await supabase.from('push_subscriptions').select('*')
    const payload = JSON.stringify({ title, body: message, url })

    let sent = 0
    let removed = 0
    for (const s of subs ?? []) {
      try {
        const subscriber = appServer.subscribe({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        })
        await subscriber.pushTextMessage(payload, {})
        sent++
      } catch (e) {
        const status = (e as { response?: { status?: number } }).response?.status
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        } else {
          console.error('push send error:', (e as Error).message ?? e)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, removed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-push fatal:', (e as Error).message ?? e)
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
