// Creates a new CRM user (auth account + profile role). Admin-only.
// The frontend calls this with the caller's JWT; we verify that caller is an
// admin before using the service-role key to provision the new account.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERSION = 'admin-create-user-1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = ['admin', 'agente', 'visor'] as const
type Role = typeof ROLES[number]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed', version: VERSION }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  try {
    // 1. Identify the caller from their JWT and require an admin profile.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'No autorizado' }, 401)

    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData.user) return json({ error: 'No autorizado' }, 401)

    const { data: caller } = await admin
      .from('profiles').select('role').eq('id', userData.user.id).single()
    if (caller?.role !== 'admin') return json({ error: 'Solo administradores pueden crear usuarios' }, 403)

    // 2. Validate input.
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim()
    const role: Role = ROLES.includes(body.role) ? body.role : 'agente'

    if (!email || !email.includes('@')) return json({ error: 'Email inválido' }, 400)
    if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    if (!fullName) return json({ error: 'El nombre es obligatorio' }, 400)

    // 3. Create the auth user. The on_auth_user_created trigger creates the
    //    profile row (full_name from metadata, role defaults to 'agente').
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'No se pudo crear el usuario' }, 400)
    }

    // 4. Apply the requested role + ensure full_name (trigger already inserted the row).
    const { error: profileErr } = await admin
      .from('profiles').update({ role, full_name: fullName }).eq('id', created.user.id)
    if (profileErr) return json({ error: profileErr.message }, 400)

    return json({ ok: true, id: created.user.id, email, role })
  } catch (e) {
    return json({ error: String(e), version: VERSION }, 500)
  }
})
