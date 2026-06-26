import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface BotpressPayload {
  channel: 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other'
  channel_user_id: string
  full_name?: string | null
  phone?: string | null
  email?: string | null
  budget_range?: string | null
  message?: string | null
  interest_type?: 'real_estate' | 'construction' | 'concierge' | 'other' | null
  property_of_interest?: string | null
  source?: string | null
  timestamp?: string | null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Normaliza texto para comparar nombres de propiedades:
// minúsculas, sin acentos, guiones/en-dash → espacio, espacios colapsados.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-–—_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FIELD_MAX_LENGTHS: Record<string, number> = {
  full_name: 255,
  phone: 30,
  email: 255,
  budget_range: 150,
  property_of_interest: 500,
  source: 100,
  message: 4000,
  channel_user_id: 255,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const webhookSecret = Deno.env.get('BOTPRESS_WEBHOOK_SECRET')
  const incomingSecret = req.headers.get('x-webhook-secret') ?? ''

  if (!webhookSecret || !timingSafeEqual(incomingSecret, webhookSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: BotpressPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!payload.channel || !payload.channel_user_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields: channel, channel_user_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate field lengths to prevent oversized payloads
  for (const [field, maxLen] of Object.entries(FIELD_MAX_LENGTHS)) {
    const val = (payload as Record<string, unknown>)[field]
    if (typeof val === 'string' && val.length > maxLen) {
      return new Response(JSON.stringify({ error: `Field '${field}' exceeds maximum length` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // Find the "Nuevo lead" stage (position = 1)
  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('position', 1)
    .single()

  // Check if client already exists by (channel, channel_user_id)
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id, full_name, phone, email, interest_type, property_of_interest')
    .eq('channel', payload.channel)
    .eq('channel_user_id', payload.channel_user_id)
    .maybeSingle()

  // Best-effort: vincular la propiedad de interés (texto libre) a una del catálogo
  let matchedPropertyId: string | null = null
  if (payload.property_of_interest) {
    const needle = normalize(payload.property_of_interest)
    const { data: props } = await supabase.from('properties').select('id, name, slug')
    const hit = (props ?? []).find((p: { id: string; name: string; slug: string | null }) => {
      const name = normalize(p.name)
      const slug = p.slug ? normalize(p.slug) : ''
      return (name && (name.includes(needle) || needle.includes(name))) ||
             (slug && (slug.includes(needle) || needle.includes(slug)))
    })
    matchedPropertyId = (hit as { id: string } | undefined)?.id ?? null
    console.log(`[autovínculo] "${payload.property_of_interest}" → ${matchedPropertyId ?? 'sin match'} (${props?.length ?? 0} propiedades en catálogo)`)
  }

  let clientId: string

  // Construye el objeto de actualización solo con los campos no nulos entrantes.
  function buildUpdates(): Record<string, unknown> {
    const updates: Record<string, unknown> = { last_contact_at: new Date().toISOString() }
    if (payload.full_name != null) updates.full_name = payload.full_name
    if (payload.phone != null) updates.phone = payload.phone
    if (payload.email != null) updates.email = payload.email
    if (payload.interest_type != null) updates.interest_type = payload.interest_type
    if (payload.property_of_interest != null) updates.property_of_interest = payload.property_of_interest
    if (matchedPropertyId != null) updates.property_id = matchedPropertyId
    if (payload.budget_range != null) updates.budget_range = payload.budget_range
    return updates
  }

  if (existingClient) {
    clientId = existingClient.id
    await supabase.from('clients').update(buildUpdates()).eq('id', clientId)
  } else {
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        channel: payload.channel,
        channel_user_id: payload.channel_user_id,
        full_name: payload.full_name ?? null,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        budget_range: payload.budget_range ?? null,
        interest_type: payload.interest_type ?? null,
        property_of_interest: payload.property_of_interest ?? null,
        property_id: matchedPropertyId,
        source: payload.source ?? 'Botpress',
        stage_id: firstStage?.id ?? null,
        last_contact_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (newClient) {
      clientId = newClient.id
    } else if ((insertError as { code?: string } | null)?.code === '23505') {
      // Condición de carrera: otra solicitud concurrente creó el mismo
      // (channel, channel_user_id) entre nuestro SELECT y este INSERT.
      // Recuperamos ese cliente y aplicamos los updates como si ya existiera,
      // en vez de devolver 500 (esto ocurre justo bajo ráfagas de mensajes).
      const { data: raced } = await supabase
        .from('clients')
        .select('id')
        .eq('channel', payload.channel)
        .eq('channel_user_id', payload.channel_user_id)
        .single()

      if (!raced) {
        console.error('Error inserting client (post-conflict):', insertError)
        return new Response(JSON.stringify({ error: 'Failed to create client' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      clientId = raced.id
      await supabase.from('clients').update(buildUpdates()).eq('id', clientId)
    } else {
      console.error('Error inserting client:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to create client' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Log the raw message
  await supabase.from('messages').insert({
    client_id: clientId,
    channel: payload.channel,
    direction: 'inbound',
    content: payload.message ?? null,
    raw_payload: payload as unknown as Record<string, unknown>,
  })

  // Email notification — disabled by default. To enable in production set
  // LEAD_EMAIL_NOTIFICATIONS=true (plus RESEND_API_KEY and NOTIFICATION_EMAIL).
  // Kept off during testing so new leads don't flood the inbox.
  const notifEnabled = Deno.env.get('LEAD_EMAIL_NOTIFICATIONS') === 'true'
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const notifEmail = Deno.env.get('NOTIFICATION_EMAIL')
  if (notifEnabled && resendKey && notifEmail && !existingClient) {
    const clientName = payload.full_name ?? 'Sin nombre'
    const clientPhone = payload.phone ?? '—'
    const clientEmail = payload.email ?? '—'
    const emailRequest = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'CRM Sunrise Discovery <onboarding@resend.dev>',
        to: [notifEmail],
        subject: `Nuevo lead: ${clientName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#0a2540;margin-bottom:16px">Nuevo lead en el CRM</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Nombre</td><td style="padding:8px 0;font-size:14px;font-weight:600">${clientName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Teléfono</td><td style="padding:8px 0;font-size:14px">${clientPhone}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Email</td><td style="padding:8px 0;font-size:14px">${clientEmail}</td></tr>
              <tr><td style="padding:8px 0;color:#666;font-size:14px">Canal</td><td style="padding:8px 0;font-size:14px">${payload.channel}</td></tr>
              ${payload.budget_range ? `<tr><td style="padding:8px 0;color:#666;font-size:14px">Presupuesto</td><td style="padding:8px 0;font-size:14px">${payload.budget_range}</td></tr>` : ''}
            </table>
            <a href="${Deno.env.get('APP_URL') ?? 'https://sunrise-crm-drab.vercel.app'}/clients/${clientId}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#1ebbae;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">
              Ver en el CRM →
            </a>
          </div>
        `,
      }),
    }).catch(() => { /* silently ignore email errors */ })

    // No bloquear la respuesta esperando a Resend: enviar el correo en segundo
    // plano. Bajo ráfagas de leads esto evita sumar ~200-500ms a cada solicitud.
    const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
    if (edge) edge.waitUntil(emailRequest)
  }

  return new Response(JSON.stringify({ status: 'ok', client_id: clientId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
