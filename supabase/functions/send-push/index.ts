import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VERSION = 'webpush-1'

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

    step = 'setVapidDetails'
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@sunrisediscovery.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    )

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
    let lastError: string | null = null
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        lastError = String((e as { body?: string }).body ?? (e as Error).message ?? e)
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, version: VERSION, subs: subs?.length ?? 0, sent, removed, lastError }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-push fatal:', step, (e as Error).message ?? e)
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e), step, version: VERSION }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
