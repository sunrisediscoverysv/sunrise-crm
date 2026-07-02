# Chatwoot → CRM — Espejo de mensajes salientes

Edge Function `chatwoot-webhook`: refleja en el CRM (`/inbox`) los mensajes que los
agentes escriben desde Chatwoot, mientras dure la transición a la bandeja propia.
Cuando se apague Chatwoot (Fase 7 del roadmap), esta función se elimina junto con él.

## Qué refleja y qué no

| Evento en Chatwoot                          | ¿Se refleja? |
|---------------------------------------------|--------------|
| Mensaje saliente escrito por un agente      | ✅ Sí        |
| Mensaje entrante del cliente                | ❌ No (ya lo registra `botpress-webhook`) |
| Nota privada                                | ❌ No        |
| Mensaje del bot (`agent_bot`)               | ❌ No        |
| Saliente a un contacto que el CRM no conoce | ❌ No (el cliente nace del primer entrante) |

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

## Secrets y deploy

```bash
supabase secrets set CHATWOOT_WEBHOOK_TOKEN=<token aleatorio>
supabase functions deploy chatwoot-webhook
```

`verify_jwt = false` ya está en `supabase/config.toml` (Chatwoot no puede enviar
JWT de Supabase; la autenticación es el token de la query string).

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
