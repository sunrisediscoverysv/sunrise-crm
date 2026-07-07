// Crea/actualiza/elimina el evento de Google Calendar de una cita.
//   POST { appointmentId }                       → upsert del evento (crea o actualiza)
//   POST { action: 'delete', googleEventId }     → elimina el evento
import { CORS, serviceClient, callerId, getValidAccessToken } from '../_shared/google.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const userId = await callerId(req)
  if (!userId) return json({ error: 'No autorizado' }, 401)

  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) return json({ error: 'not_connected' }, 409)

  const body = await req.json().catch(() => ({}))
  const admin = serviceClient()

  // ── Eliminar ───────────────────────────────────────────────────────────────
  if (body.action === 'delete') {
    if (!body.googleEventId) return json({ ok: true })
    await fetch(`${CAL}/${body.googleEventId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    return json({ ok: true })
  }

  // ── Crear / actualizar ───────────────────────────────────────────────────────
  const appointmentId = body.appointmentId
  if (!appointmentId) return json({ error: 'appointmentId requerido' }, 400)

  const { data: appt } = await admin
    .from('appointments')
    .select('id, title, starts_at, ends_at, location, notes, google_event_id, clients:client_id ( full_name )')
    .eq('id', appointmentId).single()
  if (!appt) return json({ error: 'Cita no encontrada' }, 404)

  const clientName = (appt.clients as { full_name: string | null } | null)?.full_name ?? 'Cliente'
  const start = appt.starts_at as string
  const end = (appt.ends_at as string | null) ?? new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString()

  const event = {
    summary: appt.title || `Cita con ${clientName}`,
    description: appt.notes ?? undefined,
    location: appt.location ?? undefined,
    start: { dateTime: start },
    end: { dateTime: end },
  }

  const existing = appt.google_event_id as string | null
  const res = await fetch(existing ? `${CAL}/${existing}` : CAL, {
    method: existing ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: 'google_error', detail }, 502)
  }
  const created = await res.json()

  if (!existing && created.id) {
    await admin.from('appointments').update({ google_event_id: created.id }).eq('id', appointmentId)
  }

  return json({ ok: true, eventId: created.id, htmlLink: created.htmlLink })
})
