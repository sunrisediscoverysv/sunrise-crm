import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as webpush from 'jsr:@negrel/webpush@0.3.0'

const VERSION = 'diag-2'

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
    return new Response(JSON.stringify({ error: 'Unauthorized', version: VERSION }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  let step = 'start'
  try {
    const body = await req.json().catch(() => ({}))
    let title = 'Sunrise CRM', message = '', url = '/'
    const record = body.record
    if (record) {
      title = '🎯 Nuevo lead'
      message = record.channel ? `${record.full_name ?? 'Sin nombre'} · ${record.channel}` : (record.full_name ?? 'Sin nombre')
      url = `/clients/${record.id}`
    } else {
      title = body.title ?? title; message = body.body ?? ''; url = body.url ?? '/'
    }

    step = 'vapid-decode'
    const pub = b64urlToBytes(Deno.env.get('VAPID_PUBLIC_KEY') ?? '')
    const x = bytesToB64url(pub.slice(1, 33))
    const y = bytesToB64url(pub.slice(33, 65))
    const d = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

    step = 'importVapidKeys'
    const vapidKeys = await webpush.importVapidKeys({
      publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true, key_ops: ['verify'] },
      privateKey: { kty: 'EC', crv: 'P-256', x, y, d, ext: true, key_ops: ['sign'] },
    }, { extractable: false })

    step = 'appServer'
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@sunrisediscovery.com',
      vapidKeys,
    })

    step = 'query-subs'
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )
    const { data: subs } = await supabase.from('push_subscriptions').select('*')
    const payload = JSON.stringify({ title, body: message, url })

    step = 'send'
    let sent = 0, removed = 0
    for (const s of subs ?? []) {
      try {
        const subscriber = appServer.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
        await subscriber.pushTextMessage(payload, {})
        sent++
      } catch (e) {
        const status = e?.response?.status
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        } else {
          console.error('push send error:', e?.message ?? e)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, version: VERSION, subs: subs?.length ?? 0, sent, removed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-push fatal:', step, e?.message ?? e)
    return new Response(JSON.stringify({ error: String(e?.message ?? e), step, version: VERSION }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
