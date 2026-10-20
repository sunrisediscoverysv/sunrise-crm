# Handoff Chatwoot → CRM → Botpress

El CRM actúa de puente: espeja el estado de las conversaciones de Chatwoot y
expone un endpoint donde Botpress pregunta si debe callarse.

```
Instagram / Messenger / WhatsApp → Chatwoot → chatwoot-webhook → chatwoot_conversations
                                                                         ↑
                                          Botpress → chatwoot-status ────┘
```

## Endpoint

```
POST https://hossxvizztnvldoibnrh.supabase.co/functions/v1/chatwoot-status
Content-Type: application/json
x-webhook-secret: <BOTPRESS_WEBHOOK_SECRET>
```

Se acepta `x-botpress-secret` como alias de la cabecera. El secreto es el
**mismo** que ya usa `botpress-webhook`: no hay variable de entorno nueva.

### Petición

```json
{ "channel": "instagram", "external_user_id": "2227588257804403" }
```

`channel` ∈ `instagram` | `messenger` | `whatsapp`. Para WhatsApp el teléfono se
normaliza a solo dígitos, así que `+503 7777 0000` y `50377770000` son equivalentes.

### Respuesta

```json
{
  "success": true,
  "found": true,
  "channel": "instagram",
  "external_user_id": "2227588257804403",
  "conversation_id": 123456,
  "assigned": true,
  "assignee_id": 184155,
  "assignee_name": "Agente Demo",
  "status": "open",
  "resolved": false,
  "handoff": true
}
```

La única variable que Botpress necesita mirar es `handoff`.

## Reglas de `handoff`

| Situación en Chatwoot | `handoff` |
|---|---|
| Agente asignado y `status != resolved` | `true` |
| `status = resolved` (aunque tenga agente) | `false` |
| Sin agente | `false` |
| Usuario no encontrado | `false` |
| Error interno o de base de datos | `false` |

**Nunca** se devuelve `handoff: true` por un fallo: un error deja hablar al bot
en vez de dejar al cliente sin respuesta.

## Varias conversaciones del mismo contacto

1. Se toman hasta 25 conversaciones de ese usuario en ese canal.
2. Gana la **activa** (`open`, `pending`, `snoozed`) con `last_event_at` más reciente.
3. Si ninguna está activa, gana la más reciente de todas — y como estará
   `resolved`, `handoff` queda en `false`.

Una conversación resuelta antigua nunca tapa a una activa posterior.

## Identificación del usuario externo

Chatwoot no expone un único campo estable, así que la tabla guarda **todas** las
identidades y el endpoint busca por cualquiera de ellas:

| Columna | Origen | Canal |
|---|---|---|
| `source_id` | API de Chatwoot, `contact_inboxes[].source_id` | Instagram / Messenger — es el IGSID/PSID que Botpress ve como `instagram:id` |
| `contact_identifier` | webhook, `conversation.meta.sender.identifier` | puede venir nulo |
| `chatwoot_contact_id` | webhook, `conversation.meta.sender.id` | id interno de Chatwoot |
| `phone_digits` | webhook, `meta.sender.phone_number` normalizado | WhatsApp |

`source_id` **no viene en el webhook**: `chatwoot-webhook` lo pide a la API la
primera vez que ve una conversación de Instagram/Messenger, en segundo plano.

## Sincronización

`chatwoot-webhook` hace `upsert` por `chatwoot_conversation_id` (clave primaria,
por lo que los reintentos de Chatwoot no duplican filas) en **todos** los
eventos, antes de los filtros de mensaje.

Los campos nulos no pisan lo guardado. En particular, un `message_created` sin
la clave `meta.assignee` **no** desasigna: hacerlo devolvería la palabra al bot
en medio de una conversación atendida.

### Eventos necesarios en Chatwoot

En *Settings → Integrations → Webhooks* deben estar marcados:

- `message_created` — ya estaba; mantiene el reflejo de mensajes.
- `conversation_created`
- `conversation_updated` — **imprescindible**: es el que trae los cambios de agente.
- `conversation_status_changed`

Si solo llega `message_created`, el estado se completa preguntando a la API la
primera vez que se ve la conversación, pero las reasignaciones posteriores
tardarán hasta 5 minutos en reflejarse (ver abajo).

## Chatwoot como fuente de verdad

Si la fila local lleva más de **5 minutos** sin actualizarse, `chatwoot-status`
consulta `GET /api/v1/accounts/{account}/conversations/{id}` antes de responder y
refresca el espejo. Si la API falla, responde con la copia local en vez de dar error.

## Variables de entorno

Ninguna nueva. Se reutilizan:

- `BOTPRESS_WEBHOOK_SECRET` — autentica el endpoint.
- `CHATWOOT_BASE_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_API_TOKEN` — ya usadas por `chatwoot-send`.

## Pruebas

```bash
deno test supabase/functions/_shared/chatwoot.test.ts   # casos A–E, lógica pura
```

Contra el entorno desplegado:

```bash
SECRET=<BOTPRESS_WEBHOOK_SECRET>
BASE=https://hossxvizztnvldoibnrh.supabase.co/functions/v1/chatwoot-status

curl -s -X POST "$BASE" -H "x-webhook-secret: $SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"channel":"instagram","external_user_id":"2227588257804403"}'

curl -s -X POST "$BASE" -H "x-webhook-secret: $SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"channel":"whatsapp","external_user_id":"+503 7777 0000"}'

# Debe responder 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE" \
  -H 'Content-Type: application/json' -d '{"channel":"instagram","external_user_id":"1"}'
```

## Limitaciones

- La tabla se llena con los eventos que van llegando. Una conversación que no
  reciba ningún evento después del despliegue no existirá en el espejo y
  devolverá `found: false` (por tanto `handoff: false`). Se resuelve sola en el
  siguiente mensaje.
- Los contactos de Instagram/Messenger creados **antes** de esta migración
  guardan en `clients.channel_user_id` el id interno de Chatwoot, no el IGSID.
  El endpoint no depende de esa columna, así que no les afecta.
