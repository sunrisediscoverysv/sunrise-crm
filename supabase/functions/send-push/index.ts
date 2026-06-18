import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Envía Web Push a todos los dispositivos suscritos.
// Se invoca de dos formas:
//  1) Database Webhook de Supabase en INSERT sobre `clients`  → body.record = nuevo lead
//  2) Llamada manual con { title, body, url }                 → notificación a medida
// Protegido con el header x-push-secret (== env PUSH_SECRET).

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('PUSH_SECRET')
  if (!secret || req.headers.get('x-push-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

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

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@sunrisediscovery.com',
    Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  )

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
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        removed++
      } else {
        console.error('push error', code, (e as Error).message)
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, removed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
