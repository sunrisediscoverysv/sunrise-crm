// Flujo OAuth de Google Calendar:
//   POST { action: 'auth-url' }  (con JWT)  → devuelve la URL de consentimiento
//   POST { action: 'disconnect' } (con JWT) → borra la conexión del usuario
//   GET  ?code=...&state=...                → callback: canjea el código y guarda tokens
import {
  CORS, GOOGLE_SCOPE, env, serviceClient, redirectUri, appUrl,
  signState, verifyState, callerId,
} from '../_shared/google.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)

  // ── Callback de Google (redirección del navegador) ─────────────────────────
  if (req.method === 'GET' && (url.searchParams.get('code') || url.searchParams.get('error'))) {
    const err = url.searchParams.get('error')
    if (err) return Response.redirect(`${appUrl()}/calendar?google=error`, 302)

    const code = url.searchParams.get('code') ?? ''
    const state = url.searchParams.get('state') ?? ''
    const userId = await verifyState(state)
    if (!userId) return Response.redirect(`${appUrl()}/calendar?google=error`, 302)

    // Canjear el código por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env('GOOGLE_CLIENT_ID'),
        client_secret: env('GOOGLE_CLIENT_SECRET'),
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) return Response.redirect(`${appUrl()}/calendar?google=error`, 302)
    const t = await tokenRes.json()

    // Email de la cuenta conectada
    let email: string | null = null
    try {
      const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${t.access_token}` },
      })
      if (info.ok) email = (await info.json()).email ?? null
    } catch { /* opcional */ }

    const expiry = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString()
    await serviceClient().from('google_calendar_tokens').upsert({
      user_id: userId,
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? null,
      token_expiry: expiry,
      google_email: email,
      scope: t.scope ?? GOOGLE_SCOPE,
    }, { onConflict: 'user_id' })

    return Response.redirect(`${appUrl()}/calendar?google=connected`, 302)
  }

  // ── Acciones autenticadas ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const userId = await callerId(req)
    if (!userId) return json({ error: 'No autorizado' }, 401)

    const body = await req.json().catch(() => ({}))

    if (body.action === 'auth-url') {
      if (!env('GOOGLE_CLIENT_ID')) return json({ error: 'Falta configurar GOOGLE_CLIENT_ID' }, 500)
      const params = new URLSearchParams({
        client_id: env('GOOGLE_CLIENT_ID'),
        redirect_uri: redirectUri(),
        response_type: 'code',
        scope: GOOGLE_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state: await signState(userId),
      })
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
    }

    if (body.action === 'disconnect') {
      await serviceClient().from('google_calendar_tokens').delete().eq('user_id', userId)
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  }

  return json({ error: 'Método no permitido' }, 405)
})
