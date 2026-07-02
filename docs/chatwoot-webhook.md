# Chatwoot → CRM — Espejo de mensajes salientes

Edge Function `chatwoot-webhook`: refleja en el CRM (`/inbox`) los mensajes que los
agentes escriben desde Chatwoot, mientras dure la transición a la bandeja propia.
Cuando se apague Chatwoot (Fase 7 del roadmap), esta función se elimina junto con él.

## Qué refleja y qué no

| Evento en Chatwoot                                      | ¿Se refleja? |
|----------------------------------------------------------|--------------|
| Mensaje saliente escrito por un agente                   | ✅ Sí (outbound) |
| Entrante del cliente con conversación en agente (`open`) | ✅ Sí (inbound) — Chatwoot no reenvía a Botpress fuera de la fase bot, así que esta es la única vía al CRM |
| Entrante del cliente en fase bot (`pending`)             | ❌ No (ya lo registra `botpress-webhook`; aceptarlo duplicaría) |
| Nota privada                                             | ❌ No        |
| Mensaje del bot (`agent_bot`)                            | ❌ No        |
| Mensaje de un contacto que el CRM no conoce              | ❌ No (el cliente nace del primer entrante vía Botpress) |

Red de seguridad extra: un inbound idéntico para el mismo cliente en los últimos
90 segundos se descarta (cubre la transición de fase bot→agente y setups sin
status `pending`).

El matching de cliente es por teléfono: `channel_user_id` (dígitos) y, como
respaldo, `clients.phone` tal cual. Es idempotente ante reintentos de Chatwoot
(deduplica por `chatwoot_message_id` en `raw_payload`).

## Configuración en Chatwoot

1. Ir a **Settings → Integrations → Webhooks → Add new webhook**.
2. URL (el token es el secret `CHATWOOT_WEBHOOK_TOKEN` de Supabase):

   ```
   https://<project-ref>.supabase.co/functions/v1/chatwoot-webhook?token=<TOKEN>
   ```

3. Suscribir **solo** el evento `message_created`.

## Autenticación (doble vía, basta una)

1. **Firma HMAC de Chatwoot** (preferida): al crear el webhook, Chatwoot muestra un
   secret y firma cada petición con `X-Chatwoot-Signature: sha256=HMAC(secret,
   "{timestamp}.{raw_body}")` + `X-Chatwoot-Timestamp`. Guardar ese secret en
   `CHATWOOT_WEBHOOK_SECRET`. Se rechazan timestamps a >10 min (anti-replay).
2. **Token en query string** (`?token=` vs `CHATWOOT_WEBHOOK_TOKEN`): respaldo por
   si la versión de Chatwoot no firma o firma mal
   ([issue #13809](https://github.com/chatwoot/chatwoot/issues/13809)).

## Secrets y deploy

```bash
supabase secrets set CHATWOOT_WEBHOOK_TOKEN=<token aleatorio>
supabase secrets set CHATWOOT_WEBHOOK_SECRET=<secret mostrado por Chatwoot>
supabase functions deploy chatwoot-webhook
```

`verify_jwt = false` ya está en `supabase/config.toml` (Chatwoot no envía JWT de
Supabase).

## Prueba manual (curl)

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/chatwoot-webhook?token=<TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message_created",
    "id": 999001,
    "content": "Hola, le escribo desde Chatwoot",
    "message_type": "outgoing",
    "private": false,
    "sender": { "id": 1, "name": "Agente Prueba", "type": "user" },
    "conversation": { "id": 55, "meta": { "sender": { "phone_number": "+50376008682" } } }
  }'
```

Respuestas esperadas: `{"status":"ok",...}` si el teléfono corresponde a un
cliente del CRM; `{"status":"ignored","reason":"..."}` si el evento no aplica.
