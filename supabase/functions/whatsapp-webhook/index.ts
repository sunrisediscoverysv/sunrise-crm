import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Webhook de WhatsApp Cloud API (Meta) para capturar el ESTADO DE ENTREGA de los
// mensajes salientes. Cuando el CRM envía una plantilla/texto, Meta responde de
// inmediato con "accepted" (aceptado en cola) pero NO garantiza la entrega. Los
// estados reales — sent / delivered / read / failed — llegan aquí de forma
// asíncrona. Emparejamos cada evento con la fila de `messages` por el id de Meta
// y guardamos el estado (y el motivo del error si falló) para verlo en el CRM.
//
// Esta función NO procesa mensajes entrantes de clientes: ese canal lo maneja
// Botpress. Aquí solo nos interesa el array `statuses`.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

// Verifica la firma X-Hub-Signature-256 (HMAC-SHA256 del cuerpo crudo con el
// App Secret de la app de Meta). Devuelve true si es válida o si no hay secreto
// configurado todavía (modo permisivo inicial, con aviso en logs).
async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  if (!appSecret) {
    console.warn('[whatsapp-webhook] WHATSAPP_APP_SECRET no configurado: se omite la verificación de firma.')
    return true
  }
  if (!header?.startsWith('sha256=')) return false
  const expected = header.slice('sha256='.length)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const computed = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(computed, expected)
}

interface WaStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp?: string
  recipient_id?: string
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── 1) Verificación del webhook (handshake de Meta) ───────────────────────
  //    Meta hace un GET con hub.mode=subscribe, hub.verify_token y hub.challenge.
  //    Debemos devolver el challenge en texto plano si el token coincide.
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    if (mode === 'subscribe' && expected && token === expected) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // ── 2) Verificar la firma del cuerpo ──────────────────────────────────────
  const rawBody = await req.text()
  const validSig = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'))
  if (!validSig) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: {
    entry?: Array<{ changes?: Array<{ value?: { statuses?: WaStatus[] } }> }>
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── 3) Procesar los estados y actualizar las filas de messages ────────────
  const statuses: WaStatus[] = []
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const st of change.value?.statuses ?? []) statuses.push(st)
    }
  }

  if (statuses.length > 0) {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    // Prioridad de estados: no queremos que un "sent" tardío pise un "delivered".
    const rank: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 }

    for (const st of statuses) {
      if (!st.id || !st.status) continue
      const err = st.errors?.[0]
      if (st.status === 'failed' && err) {
        console.error(`[whatsapp-webhook] Mensaje ${st.id} FALLÓ: code=${err.code} title="${err.title}" details="${err.error_data?.details ?? ''}"`)
      }

      // Leemos el estado actual para no retroceder de rango (excepto failed, que
      // siempre gana porque es información crítica para el agente).
      const { data: current } = await admin
        .from('messages')
        .select('id, wa_status')
        .eq('wa_message_id', st.id)
        .maybeSingle()

      if (!current) continue // el id no corresponde a un mensaje que enviamos

      const currentRank = rank[current.wa_status ?? 'accepted'] ?? 0
      const nextRank = rank[st.status] ?? 0
      if (st.status !== 'failed' && nextRank <= currentRank) continue

      await admin
        .from('messages')
        .update({
          wa_status: st.status,
          wa_error: st.status === 'failed' && err
            ? { code: err.code, title: err.title, message: err.message, details: err.error_data?.details }
            : null,
        })
        .eq('id', current.id)
    }
  }

  // Meta exige un 200 rápido; si no, reintenta y puede deshabilitar el webhook.
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
