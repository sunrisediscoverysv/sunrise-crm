// Helpers compartidos para la integración con Google Calendar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email'

export const env = (k: string) => Deno.env.get(k) ?? ''

export function serviceClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

export function redirectUri() {
  return `${env('SUPABASE_URL')}/functions/v1/google-oauth`
}

export function appUrl() {
  return env('APP_URL') || 'https://sunrise-crm-drab.vercel.app'
}

// ── State firmado (HMAC) para transportar el user id por el flujo OAuth ───────
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env('SUPABASE_SERVICE_ROLE_KEY')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function signState(userId: string): Promise<string> {
  return `${userId}.${await hmac(userId)}`
}

export async function verifyState(state: string): Promise<string | null> {
  const [userId, sig] = state.split('.')
  if (!userId || !sig) return null
  return (await hmac(userId)) === sig ? userId : null
}

// ── Identidad del que llama a partir de su JWT ───────────────────────────────
export async function callerId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return null
  const { data } = await serviceClient().auth.getUser(token)
  return data.user?.id ?? null
}

// ── Access token válido (refresca si expiró) ─────────────────────────────────
interface TokenRow {
  access_token: string
  refresh_token: string | null
  token_expiry: string | null
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const admin = serviceClient()
  const { data } = await admin
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId).single<TokenRow>()
  if (!data) return null

  const notExpired = data.token_expiry && new Date(data.token_expiry).getTime() > Date.now() + 60_000
  if (notExpired) return data.access_token
  if (!data.refresh_token) return data.access_token // no refresh available; try as-is

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return data.access_token
  const t = await res.json()
  const expiry = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString()
  await admin.from('google_calendar_tokens')
    .update({ access_token: t.access_token, token_expiry: expiry })
    .eq('user_id', userId)
  return t.access_token
}
