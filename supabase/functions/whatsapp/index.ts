import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAPH_VERSION = 'v21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tipos de mensaje multimedia de la Cloud API. Lo que no sea imagen/video/audio
// soportado se manda como documento (PDF, Word, Excel, webp, etc.).
// Mantener en sincronía con apps/web/src/features/whatsapp/whatsappMedia.ts.
type MediaKind = 'image' | 'video' | 'audio' | 'document'

const MB = 1024 * 1024
const WHATSAPP_MEDIA_LIMITS: Record<MediaKind, number> = {
  image: 5 * MB, video: 16 * MB, audio: 16 * MB, document: 25 * MB,
}

const MEDIA_LABEL: Record<MediaKind, string> = {
  image: '[Imagen]', video: '[Video]', audio: '[Audio]', document: '[Documento]',
}

function whatsappMediaKind(mime: string): MediaKind {
  const m = mime.toLowerCase().split(';')[0].trim()
  if (m === 'image/jpeg' || m === 'image/png') return 'image'
  if (m === 'video/mp4' || m === 'video/3gpp') return 'video'
  if (['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(m)) return 'audio'
  return 'document'
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1) Solo usuarios logueados del CRM pueden usar esta función.
  //    supabase.functions.invoke envía automáticamente el access token del usuario.
  const authHeader = req.headers.get('Authorization') ?? ''
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: { user }, error: userErr } = await authClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

  // 2) Credenciales de Meta (secretos del proyecto)
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const wabaId = Deno.env.get('WHATSAPP_WABA_ID')
  if (!token || !phoneNumberId || !wabaId) {
    return json({ error: 'WhatsApp no está configurado todavía (faltan los secretos en Supabase).' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const action = (body.action as string) ?? 'send'

  // ── Listar plantillas aprobadas ────────────────────────────────────────────
  if (action === 'list') {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?limit=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const data = await res.json()
    if (!res.ok) return json({ error: data?.error?.message ?? 'Error al listar plantillas' }, 502)

    interface MetaTemplate {
      name: string
      language: string
      category: string
      status: string
      components: unknown[]
    }
    const templates = ((data.data ?? []) as MetaTemplate[])
      .filter(t => t.status === 'APPROVED')
      .map(t => ({ name: t.name, language: t.language, category: t.category, components: t.components }))
    return json({ templates })
  }

  // ── Enviar una plantilla ───────────────────────────────────────────────────
  if (action === 'send') {
    const clientId = body.client_id as string | undefined
    const to = body.to as string | undefined
    const templateName = body.template_name as string | undefined
    const language = body.language as string | undefined
    const variables = (body.variables as string[] | undefined) ?? []
    const headerImageUrl = body.header_image_url as string | undefined

    if (!to || !templateName || !language) {
      return json({ error: 'Faltan datos requeridos: to, template_name, language.' }, 400)
    }

    const components: unknown[] = []
    // Encabezado con imagen (plantillas con header IMAGE)
    if (headerImageUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: headerImageUrl } }],
      })
    }
    // Variables del cuerpo {{1}}, {{2}}…
    if (variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map(v => ({ type: 'text', text: String(v) })),
      })
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: String(to).replace(/[^\d]/g, ''), // WhatsApp espera solo dígitos con código de país
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const data = await res.json()
    if (!res.ok) return json({ error: data?.error?.message ?? 'Error al enviar la plantilla', meta: data?.error }, 502)

    // Registrar el envío en el historial del cliente (service role salta RLS)
    if (clientId) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } },
      )
      const summary = `[Plantilla: ${templateName}]${variables.length ? ' ' + variables.join(' · ') : ''}`
      await admin.from('messages').insert({
        client_id: clientId,
        channel: 'whatsapp',
        direction: 'outbound',
        content: summary,
        wa_message_id: data?.messages?.[0]?.id ?? null,
        wa_status: 'accepted',
        raw_payload: { template_name: templateName, language, variables, wa_response: data },
      })
      await admin.from('clients').update({ last_contact_at: new Date().toISOString() }).eq('id', clientId)
    }

    return json({ status: 'ok', wa_message_id: data?.messages?.[0]?.id ?? null })
  }

  // ── Enviar un mensaje de texto libre (solo dentro de la ventana de 24h) ─────
  if (action === 'text') {
    const clientId = body.client_id as string | undefined
    const to = body.to as string | undefined
    const text = (body.text as string | undefined)?.trim()

    if (!to || !text) {
      return json({ error: 'Faltan datos requeridos: to, text.' }, 400)
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: String(to).replace(/[^\d]/g, ''),
      type: 'text',
      text: { body: text, preview_url: true },
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      // 131047 = "Re-engagement message": la ventana de 24h de servicio se cerró.
      // El agente debe usar una plantilla para reabrir la conversación.
      const metaCode = data?.error?.code
      if (metaCode === 131047) {
        return json({
          error: 'Pasaron más de 24h desde el último mensaje del cliente. Envía una plantilla para reabrir la conversación.',
          code: 'window_closed',
        }, 409)
      }
      return json({ error: data?.error?.message ?? 'Error al enviar el mensaje', meta: data?.error }, 502)
    }

    // Registrar el envío en el historial del cliente (service role salta RLS)
    if (clientId) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } },
      )
      await admin.from('messages').insert({
        client_id: clientId,
        channel: 'whatsapp',
        direction: 'outbound',
        content: text,
        wa_message_id: data?.messages?.[0]?.id ?? null,
        wa_status: 'accepted',
        raw_payload: { type: 'text', wa_response: data },
      })
      await admin.from('clients').update({ last_contact_at: new Date().toISOString() }).eq('id', clientId)
    }

    return json({ status: 'ok', wa_message_id: data?.messages?.[0]?.id ?? null })
  }

  // ── Enviar multimedia: imagen, video, audio o documento (ventana de 24h) ────
  // El CRM ya subió el archivo al bucket privado `client-attachments` bajo
  // `{client_id}/chat/…`. Aquí lo descargamos, lo subimos a Meta (/media) y lo
  // enviamos por id: así un archivo inválido falla al momento, en vez de
  // quedar como fallo asíncrono en un webhook de estados que no recibimos.
  if (action === 'media') {
    const clientId = body.client_id as string | undefined
    const to = body.to as string | undefined
    const storagePath = body.storage_path as string | undefined
    const caption = (body.caption as string | undefined)?.trim() || ''

    if (!clientId || !to || !storagePath) {
      return json({ error: 'Faltan datos requeridos: client_id, to, storage_path.' }, 400)
    }
    if (!storagePath.startsWith(`${clientId}/chat/`) || storagePath.includes('..')) {
      return json({ error: 'Ruta de archivo no válida.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    const { data: blob, error: dlErr } = await admin.storage.from('client-attachments').download(storagePath)
    if (dlErr || !blob) return json({ error: 'No se encontró el archivo subido.' }, 404)

    const fileName = (body.file_name as string | undefined) || storagePath.split('/').pop() || 'archivo'
    const mime = (body.mime_type as string | undefined) || blob.type || 'application/octet-stream'
    const kind = whatsappMediaKind(mime)
    const limit = WHATSAPP_MEDIA_LIMITS[kind]
    if (blob.size > limit) {
      return json({ error: `El archivo supera el máximo de ${limit / MB} MB que permite WhatsApp para este tipo.` }, 413)
    }

    // 1) Subir el binario a Meta → media id
    const form = new FormData()
    form.append('messaging_product', 'whatsapp')
    form.append('type', mime)
    form.append('file', new File([blob], fileName, { type: mime }))
    const upRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
    )
    const upData = await upRes.json()
    if (!upRes.ok || !upData?.id) {
      return json({ error: upData?.error?.message ?? 'Meta rechazó el archivo.', meta: upData?.error }, 502)
    }

    // 2) Enviar el mensaje. El audio no admite caption; el documento lleva nombre.
    const mediaObj: Record<string, unknown> = { id: upData.id }
    if (caption && kind !== 'audio') mediaObj.caption = caption
    if (kind === 'document') mediaObj.filename = fileName

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: String(to).replace(/[^\d]/g, ''),
          type: kind,
          [kind]: mediaObj,
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      if (data?.error?.code === 131047) {
        return json({
          error: 'Pasaron más de 24h desde el último mensaje del cliente. Envía una plantilla para reabrir la conversación.',
          code: 'window_closed',
        }, 409)
      }
      return json({ error: data?.error?.message ?? 'Error al enviar el archivo', meta: data?.error }, 502)
    }

    // 3) Registrar en el historial. `content` es el texto que ven las
    //    vistas previas (bandeja); el hilo pinta el archivo desde raw_payload.media.
    const sendCaption = kind !== 'audio' ? caption : ''
    await admin.from('messages').insert({
      client_id: clientId,
      channel: 'whatsapp',
      direction: 'outbound',
      content: sendCaption ? `${MEDIA_LABEL[kind]} ${sendCaption}` : MEDIA_LABEL[kind],
      wa_message_id: data?.messages?.[0]?.id ?? null,
      wa_status: 'accepted',
      raw_payload: {
        type: 'media',
        caption: sendCaption || null,
        media: {
          kind,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: mime,
          size: blob.size,
          wa_media_id: upData.id,
        },
        wa_response: data,
      },
    })
    await admin.from('clients').update({ last_contact_at: new Date().toISOString() }).eq('id', clientId)

    return json({ status: 'ok', wa_message_id: data?.messages?.[0]?.id ?? null })
  }

  return json({ error: `Acción no soportada: ${action}` }, 400)
})
