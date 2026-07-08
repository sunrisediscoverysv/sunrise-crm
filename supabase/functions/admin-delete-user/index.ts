// Elimina un usuario del CRM (cuenta auth + perfil). Solo admins.
// Antes de borrar, limpia las referencias al perfil: desasigna clientes/citas,
// anula autorías en historial y elimina sus comentarios (author_id es NOT NULL).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  try {
    // Solo un admin puede eliminar usuarios.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'No autorizado' }, 401)
    const { data: userData } = await admin.auth.getUser(token)
    if (!userData.user) return json({ error: 'No autorizado' }, 401)
    const { data: caller } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
    if (caller?.role !== 'admin') return json({ error: 'Solo administradores pueden eliminar usuarios' }, 403)

    const body = await req.json().catch(() => ({}))
    const targetId = String(body.user_id ?? '')
    if (!targetId) return json({ error: 'user_id requerido' }, 400)
    if (targetId === userData.user.id) return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)

    // Limpiar referencias que bloquearían el borrado (FKs sin ON DELETE).
    await admin.from('clients').update({ assigned_to: null }).eq('assigned_to', targetId)
    await admin.from('appointments').update({ assigned_to: null }).eq('assigned_to', targetId)
    await admin.from('appointments').update({ created_by: null }).eq('created_by', targetId)
    await admin.from('stage_history').update({ changed_by: null }).eq('changed_by', targetId)
    await admin.from('client_attachments').update({ uploaded_by: null }).eq('uploaded_by', targetId)
    await admin.from('client_comments').delete().eq('author_id', targetId)
    // deals/tasks/payments tienen ON DELETE SET NULL; push_subscriptions y
    // google_calendar_tokens tienen ON DELETE CASCADE — no requieren limpieza.

    // Borrar la cuenta auth (el perfil cae en cascada).
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId)
    if (delErr) return json({ error: delErr.message }, 400)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
