// Prueba de carga del webhook de leads (botpress-webhook) con k6.
//
// ⚠️ EJECUTAR SOLO CONTRA UN ENTORNO DE STAGING, nunca producción.
//    Crea muchos clientes/mensajes de prueba en la base de datos.
//
// Uso:
//   k6 run \
//     -e WEBHOOK_URL="https://<staging-ref>.supabase.co/functions/v1/botpress-webhook" \
//     -e WEBHOOK_SECRET="<secret-de-staging>" \
//     loadtest/webhook-load.js
//
// Qué mide:
//   - Latencia p95 y tasa de error bajo carga sostenida (escenario "steady").
//   - Que la corrección de condición de carrera funcione: el escenario
//     "burst_same_user" manda varios mensajes del MISMO usuario nuevo casi a
//     la vez; no debe devolver HTTP 500 (antes fallaba con clave duplicada).

import http from 'k6/http'
import { check, sleep } from 'k6'

const URL = __ENV.WEBHOOK_URL
const SECRET = __ENV.WEBHOOK_SECRET

if (!URL || !SECRET) {
  throw new Error('Faltan variables: define WEBHOOK_URL y WEBHOOK_SECRET con -e')
}

const headers = { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET }

export const options = {
  scenarios: {
    // Carga sostenida: leads nuevos distintos, subiendo hasta 50 VUs.
    steady: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'newLead',
    },
    // Ráfaga concurrente del MISMO usuario nuevo (ejercita la carrera al crear).
    burst_same_user: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 5,
      startTime: '20s',
      exec: 'sameUserBurst',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],      // <1% de errores
    http_req_duration: ['p(95)<800'],    // p95 por debajo de 800ms
  },
}

export function newLead() {
  const id = `load-${__VU}-${__ITER}-${Date.now()}`
  const body = JSON.stringify({
    channel: 'whatsapp',
    channel_user_id: id,
    full_name: `Lead ${id}`,
    message: 'Hola, me interesa una propiedad',
    source: 'loadtest',
  })
  const res = http.post(URL, body, { headers })
  check(res, { 'steady: status 200': r => r.status === 200 })
  sleep(1)
}

export function sameUserBurst() {
  // Mismo channel_user_id compartido por todos los VUs de este escenario.
  const id = `burst-shared-${__ENV.RUN_ID || 'r1'}`
  const body = JSON.stringify({
    channel: 'whatsapp',
    channel_user_id: id,
    full_name: 'Usuario Ráfaga',
    message: 'mensaje concurrente',
    source: 'loadtest',
  })
  const res = http.post(URL, body, { headers })
  check(res, {
    'burst: sin 500': r => r.status !== 500,
    'burst: status 200': r => r.status === 200,
  })
}
