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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const webhookSecret = Deno.env.get('BOTPRESS_WEBHOOK_SECRET')
  const incomingSecret = req.headers.get('x-webhook-secret')

  if (!webhookSecret || incomingSecret !== webhookSecret) {
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

  let clientId: string

  if (!existingClient) {
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
        source: payload.source ?? 'Botpress',
        stage_id: firstStage?.id ?? null,
        last_contact_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !newClient) {
      console.error('Error inserting client:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to create client' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    clientId = newClient.id
  } else {
    clientId = existingClient.id

    // Build update object with only non-null incoming fields
    const updates: Record<string, unknown> = { last_contact_at: new Date().toISOString() }
    if (payload.full_name != null) updates.full_name = payload.full_name
    if (payload.phone != null) updates.phone = payload.phone
    if (payload.email != null) updates.email = payload.email
    if (payload.interest_type != null) updates.interest_type = payload.interest_type
    if (payload.property_of_interest != null) updates.property_of_interest = payload.property_of_interest
    if (payload.budget_range != null) updates.budget_range = payload.budget_range

    await supabase.from('clients').update(updates).eq('id', clientId)
  }

  // Log the raw message
  await supabase.from('messages').insert({
    client_id: clientId,
    channel: payload.channel,
    direction: 'inbound',
    content: payload.message ?? null,
    raw_payload: payload as unknown as Record<string, unknown>,
  })

  // Email notification — only fires if RESEND_API_KEY and NOTIFICATION_EMAIL are configured
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const notifEmail = Deno.env.get('NOTIFICATION_EMAIL')
  if (resendKey && notifEmail && !existingClient) {
    const clientName = payload.full_name ?? 'Sin nombre'
    const clientPhone = payload.phone ?? '—'
    const clientEmail = payload.email ?? '—'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'CRM Sunrise Discovery <noreply@sunrisediscovery.com>',
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
            <a href="https://sunrise-crm-drab.vercel.app/clients/${clientId}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#1ebbae;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">
              Ver en el CRM →
            </a>
          </div>
        `,
      }),
    }).catch(() => { /* silently ignore email errors */ })
  }

  return new Response(JSON.stringify({ status: 'ok', client_id: clientId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
