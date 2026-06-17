---
name: botpress-webhook-contract
description: Contrato exacto del payload que envía Botpress al webhook; usar siempre que se modifique la Edge Function botpress-webhook.
paths: supabase/functions/botpress-webhook/**
---

# Botpress → Sunrise CRM — Webhook Contract

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/botpress-webhook
```

## Header de autenticación

```
x-webhook-secret: <valor de la variable de entorno BOTPRESS_WEBHOOK_SECRET>
```

Si el header no coincide → responder `401 Unauthorized`.

## Payload (body JSON)

```json
{
  "channel": "whatsapp",
  "channel_user_id": "50376008682",
  "full_name": "Juan Pérez",
  "phone": "+50376008682",
  "email": null,
  "message": "Hola, quiero información sobre el lote en El Zonte",
  "interest_type": "real_estate",
  "property_of_interest": "Ocean-View Development Land - El Zonte",
  "timestamp": "2026-06-16T10:00:00Z"
}
```

### Campos obligatorios

| Campo            | Tipo   | Valores posibles                                              |
|------------------|--------|---------------------------------------------------------------|
| `channel`        | string | `"whatsapp"`, `"instagram"`, `"messenger"`, `"web_chat"`, `"other"` |
| `channel_user_id`| string | ID externo del usuario en ese canal (ej. número de teléfono) |

### Campos opcionales (pueden ser `null`)

| Campo                  | Tipo   | Descripción                          |
|------------------------|--------|--------------------------------------|
| `full_name`            | string | Nombre completo capturado por el bot |
| `phone`                | string | Teléfono con código de país          |
| `email`                | string | Email si fue capturado               |
| `message`              | string | Último mensaje del usuario           |
| `interest_type`        | string | `"real_estate"`, `"construction"`, `"concierge"`, `"other"` |
| `property_of_interest` | string | Nombre o descripción de la propiedad |
| `timestamp`            | string | ISO 8601 del momento del mensaje     |

## Lógica de la Edge Function (paso a paso)

1. **Validar** el header `x-webhook-secret` contra `Deno.env.get("BOTPRESS_WEBHOOK_SECRET")`. Si no coincide → `401`.
2. **Parsear** el body JSON.
3. **Buscar** cliente existente por `(channel, channel_user_id)` en la tabla `clients`.
4. **Si no existe**: crear cliente con `stage_id` = UUID de la etapa con `position = 1` (`Nuevo lead`).
5. **Si existe**: hacer `update clients set last_contact_at = now(), ...` actualizando solo los campos no nulos del payload.
6. **Insertar** en `messages`:
   - `direction = 'inbound'`
   - `content = payload.message`
   - `raw_payload = <body completo>`
7. **Responder** `200 { "status": "ok", "client_id": "<uuid>" }` — responder siempre rápido (Botpress tiene timeout de pocos segundos).

## Variables de entorno necesarias

| Variable                    | Dónde configurar                    |
|-----------------------------|-------------------------------------|
| `BOTPRESS_WEBHOOK_SECRET`   | Supabase secrets (CLI o dashboard)  |
| `SUPABASE_SERVICE_ROLE_KEY` | Disponible automáticamente en Deno  |
| `SUPABASE_URL`              | Disponible automáticamente en Deno  |

## Ejemplo de prueba local (curl)

```bash
curl -i -X POST http://localhost:54321/functions/v1/botpress-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: mi-secreto-local" \
  -d '{
    "channel": "whatsapp",
    "channel_user_id": "50376008682",
    "full_name": "Juan Pérez",
    "phone": "+50376008682",
    "email": null,
    "message": "Hola, quiero información sobre el lote en El Zonte",
    "interest_type": "real_estate",
    "property_of_interest": "Ocean-View Development Land - El Zonte",
    "timestamp": "2026-06-16T10:00:00Z"
  }'
```

## Configurar en Botpress Studio

En el flujo de Botpress, agregar un nodo **"Execute Code"** o **"HTTP Request"** al final de la captura de datos:

- Método: `POST`
- URL: `https://<project-ref>.supabase.co/functions/v1/botpress-webhook`
- Headers: `{ "Content-Type": "application/json", "x-webhook-secret": "{{env.WEBHOOK_SECRET}}" }`
- Body: construir el JSON con las variables de conversación de Botpress

Ver `docs/botpress-integration.md` para instrucciones detalladas de configuración en Botpress Studio.
