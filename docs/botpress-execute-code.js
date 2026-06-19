// =============================================================================
// Botpress Studio — Nodo "Execute Code"
// =============================================================================
// Este código NO se ejecuta en este repo: vive en Botpress Studio, en el nodo
// "Execute Code" al final del flujo de captura de datos. Se guarda aquí solo
// como referencia versionada.
//
// Qué hace:
//   1. Arma el payload con los datos capturados por el bot.
//   2. Lo envía al webhook del CRM (crea/actualiza el lead en Supabase).
//   3. Si el canal es WhatsApp, asigna un agente en Chatwoot por rotación.
//   4. Avisa al usuario que un agente continuará la conversación.
// =============================================================================

const name     = String(workflow.user_Name     || '').trim()
const email    = String(workflow.user_Email    || '').trim()
const rawPhone = String(workflow.user_Phone    || '').trim()
const budget   = String(workflow.user_Budget   || '').trim()
const interest = String(workflow.user_Interest || '').trim()
const secret   = 'sunrise2026bp'

if (!name || !rawPhone) {
  throw new Error('Faltan campos requeridos: nombre y telefono')
}

let phone = rawPhone.replace(/\s+/g, '')
if (!phone.startsWith('+')) {
  phone = '+503' + phone
}

const rawChannel     = String(event.channel     || '').toLowerCase()
const rawIntegration = String(event.integration || '').toLowerCase()

const channelMap = {
  'chatwoot':  'whatsapp',
  'whatsapp':  'whatsapp',
  'messenger': 'messenger',
  'web':       'web_chat',
  'webchat':   'web_chat',
}
const integrationMap = {
  'instagram':                'instagram',
  'messenger':                'messenger',
  'webchat':                  'web_chat',
  'michaelbarney/chatwoot':   'whatsapp',
}
const channel = channelMap[rawChannel] || integrationMap[rawIntegration] || 'other'

const interestMap = {
  'real estate':  'real_estate',
  'inmueble':     'real_estate',
  'construccion': 'construction',
  'concierge':    'concierge',
}
const interestType  = interest ? (interestMap[interest.toLowerCase()] || null) : null
const channelUserId = String(workflow.userId || phone).trim()

const payload = {
  channel:         channel,
  channel_user_id: channelUserId,
  full_name:       name,
  email:           email  || null,
  phone:           phone,
  budget_range:    budget || null,
  interest_type:   interestType,
  source:          'Botpress',
}

console.log('Enviando a Sunrise CRM:', JSON.stringify(payload))

const response = await axios.post(
  'https://hossxvizztnvldoibnrh.supabase.co/functions/v1/botpress-webhook',
  payload,
  { headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret } }
)

if (response.data && response.data.client_id) {
  workflow.crm_client_id = String(response.data.client_id)
  console.log('EXITO! Cliente en Sunrise CRM con ID:', workflow.crm_client_id)

  if (channel === 'whatsapp') {
    try {
      // En este card "Execute Code" el objeto `conversation` NO trae los tags,
      // así que conversation.tags[...] viene vacío. Lo confiable es leerlo de
      // workflow.chatwootConvId (seteado en el autonomous node / tool isAgentAssigned).
      const tagKey = 'michaelbarney/chatwoot:chatwootId'
      const chatwootConvId =
        workflow.chatwootConvId ||
        conversation?.tags?.[tagKey] ||
        conversation?.[tagKey] ||
        null

      console.log('>>> chatwootConvId resuelto:', chatwootConvId)

      if (chatwootConvId) {
        // Credenciales: son variables de WORKFLOW (no env). Con respaldo hardcodeado.
        const CHATWOOT_TOKEN = workflow.CHATWOOT_API_TOKEN || 'zH2WXa3U2WCBccTVzPH6cw2p'
        const supabaseUrl    = workflow.SUPABASE_URL || 'https://hossxvizztnvldoibnrh.supabase.co'
        const supabaseKey    = workflow.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhvc3N4dml6enRudmxkb2libnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTIwMzEsImV4cCI6MjA5NzIyODAzMX0.-KgSRBtFRHr2wAemvUri4dXL1C1L4eiEdghmpADtK-w'
        const ACCOUNT   = 169032
        const AGENTS    = [184155, 182328]
        const AVAILABLE = ['online', 'busy']   // estados que cuentan como disponible

        // 1. Disponibilidad de agentes en Chatwoot
        let pool = AGENTS
        try {
          const agentsRes = await axios.get(
            `https://app.chatwoot.com/api/v1/accounts/${ACCOUNT}/agents`,
            { headers: { 'api_access_token': CHATWOOT_TOKEN } }
          )
          const allAgents = agentsRes.data || []
          const available = AGENTS.filter(id => {
            const a = allAgents.find(x => x.id === id)
            return a && AVAILABLE.includes(a.availability_status)
          })
          console.log('>>> Agentes disponibles:', JSON.stringify(available))
          if (available.length > 0) {
            pool = available
          } else {
            console.log('>>> Ninguno disponible, se asigna por rotación de respaldo')
          }
        } catch (e) {
          console.log('>>> No se pudo consultar disponibilidad, se usa respaldo:', e.message)
        }

        // 2. Contador round-robin vía RPC seguro (toma el índice actual y lo
        //    incrementa de forma atómica; ya no se accede a la tabla directamente)
        let currentIndex = 0
        try {
          const rotRes = await axios.post(
            `${supabaseUrl}/rest/v1/rpc/next_agent_rotation_index`,
            {},
            { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' } }
          )
          currentIndex = parseInt(rotRes.data ?? '0') || 0
        } catch (e) {
          console.log('>>> No se pudo obtener el índice de rotación, uso 0:', e.message)
        }

        // 3. Elegir agente sobre el pool disponible
        const assigneeId = pool[currentIndex % pool.length]

        // 4. Asignar agente en Chatwoot
        await axios.post(
          `https://app.chatwoot.com/api/v1/accounts/${ACCOUNT}/conversations/${chatwootConvId}/assignments`,
          { assignee_id: assigneeId },
          { headers: { 'api_access_token': CHATWOOT_TOKEN } }
        )
        console.log(`Agente ${assigneeId} asignado en Chatwoot`)

        // 5. (El contador ya fue avanzado por el RPC del paso 2 — nada que hacer aquí)

        // 6. Aviso al usuario de que un agente continuará la conversación
        await axios.post(
          `https://app.chatwoot.com/api/v1/accounts/${ACCOUNT}/conversations/${chatwootConvId}/messages`,
          {
            content: 'En este momento se contactará un agente para continuar esta conversación. 🙌',
            message_type: 'outgoing',
          },
          { headers: { 'api_access_token': CHATWOOT_TOKEN } }
        )
        console.log('Mensaje de handoff enviado al usuario')
      }
    } catch (e) {
      console.log('Error asignando agente:', e.message)
    }
  }

} else {
  console.log('Respuesta inesperada:', JSON.stringify(response.data))
  throw new Error('No se recibio client_id del CRM')
}
