# Chatwoot → CRM — Espejo de mensajes salientes

Edge Function `chatwoot-webhook`: refleja en el CRM (`/inbox`) los mensajes que los
agentes escriben desde Chatwoot, mientras dure la transición a la bandeja propia.
Cuando se apague Chatwoot (Fase 7 del roadmap), esta función se elimina junto con él.

## Qué refleja y qué no

| Evento en Chatwoot                          | ¿Se refleja? |
|----------------------------------------------|--------------|
| Mensaje saliente escrito por un agente       | ✅ Sí (outbound) |
| Entrante del cliente (cualquier status)      | ✅ Sí (inbound) |
| Nota privada                                 | ❌ No        |
| Mensaje del bot (`agent_bot`)                | ❌ No        |
| Mensaje de un contacto que el CRM no conoce  | ❌ No (el cliente nace del primer entrante vía Botpress) |

No se filtra por `conversation.status`: en este Chatwoot las conversaciones se
quedan en `pending` aunque un agente esté respondiendo, así que el status no
distingue la fase bot.

**Dedup cruzado con `botpress-webhook`** (los entrantes pueden llegar por ambas
vías): cada lado descarta un inbound idéntico (mismo cliente y contenido) de los
últimos 90 segundos registrado por **la otra fuente** — `chatwoot-webhook` marca
sus filas con `raw_payload.source = 'chatwoot'`. Dos mensajes idénticos seguidos
del cliente por la misma vía no se tragan (distinto `chatwoot_message_id`).

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
