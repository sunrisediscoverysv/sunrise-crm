# Botpress → Sunrise CRM — Guía de integración

Este documento es para quien configure el lado de Botpress en Botpress Studio.

## Endpoint del webhook

```
POST https://<project-ref>.supabase.co/functions/v1/botpress-webhook
```

Reemplaza `<project-ref>` con el ID de tu proyecto en Supabase (disponible en Project Settings → API).

## Autenticación

Cada request debe incluir el header:

```
x-webhook-secret: <tu valor de BOTPRESS_WEBHOOK_SECRET>
```

Este secreto se configura en Supabase como un secret de la Edge Function:

```bash
supabase secrets set BOTPRESS_WEBHOOK_SECRET=<valor-aleatorio-seguro>
```

## Payload que debe enviar Botpress

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

### Campos

| Campo | Obligatorio | Descripción |
|-------|-------------|-------------|
| `channel` | ✅ | Canal de origen: `whatsapp`, `instagram`, `messenger`, `web_chat`, `other` |
| `channel_user_id` | ✅ | ID único del usuario en ese canal (número de teléfono para WhatsApp) |
| `full_name` | ❌ | Nombre completo del usuario |
| `phone` | ❌ | Teléfono con código de país (ej. `+50376008682`) |
| `email` | ❌ | Email si fue capturado en la conversación |
| `message` | ❌ | Último mensaje del usuario |
| `interest_type` | ❌ | Tipo de interés: `real_estate`, `construction`, `concierge`, `other` |
| `property_of_interest` | ❌ | Nombre o descripción de la propiedad de interés |
| `timestamp` | ❌ | Hora del mensaje en ISO 8601 |

## Configuración en Botpress Studio

### Opción A: Nodo "HTTP Request"

1. Al final del flujo (después de capturar los datos del usuario), agregar un nodo **HTTP Request**.
2. Configurar:
   - **Method**: POST
   - **URL**: `https://<project-ref>.supabase.co/functions/v1/botpress-webhook`
   - **Headers**: `{"Content-Type": "application/json", "x-webhook-secret": "{{env.WEBHOOK_SECRET}}"}`
   - **Body**: construir con las variables de la conversación (ver ejemplo abajo)

### Ejemplo de body con variables de Botpress

```json
{
  "channel": "{{event.channel}}",
  "channel_user_id": "{{event.userId}}",
  "full_name": "{{workflow.userName}}",
  "phone": "{{workflow.userPhone}}",
  "email": "{{workflow.userEmail}}",
  "message": "{{event.preview}}",
  "interest_type": "{{workflow.interestType}}",
  "property_of_interest": "{{workflow.propertyInterest}}",
  "timestamp": "{{event.createdAt}}"
}
```

> Los nombres de variables (`workflow.userName`, etc.) dependen de cómo hayas nombrado las variables en tu flujo de Botpress.

### Opción B: Nodo "Execute Code"

```javascript
const axios = require('axios')

await axios.post(
  'https://<project-ref>.supabase.co/functions/v1/botpress-webhook',
  {
    channel: event.channel,
    channel_user_id: event.userId,
    full_name: workflow.userName,
    phone: workflow.userPhone,
    email: workflow.userEmail || null,
    message: event.preview,
    interest_type: workflow.interestType || null,
    property_of_interest: workflow.propertyInterest || null,
    timestamp: new Date().toISOString(),
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': env.WEBHOOK_SECRET,
    },
  }
)
```

## Respuesta esperada

**Éxito (200):**
```json
{ "status": "ok", "client_id": "550e8400-e29b-41d4-a716-446655440000" }
```

**Error de autenticación (401):**
```json
{ "error": "Unauthorized" }
```

**Error de validación (400):**
```json
{ "error": "Missing required fields: channel, channel_user_id" }
```

## Comportamiento del webhook

- Si el usuario **no existe** en el CRM → se crea con etapa "Nuevo lead" (automáticamente).
- Si el usuario **ya existe** → se actualiza `last_contact_at` y cualquier campo nuevo no nulo del payload.
- Siempre se registra el mensaje en el historial de conversación del cliente.

## Prueba manual

```bash
curl -i -X POST https://<project-ref>.supabase.co/functions/v1/botpress-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: tu-secreto-aqui" \
  -d '{
    "channel": "whatsapp",
    "channel_user_id": "50376008682",
    "full_name": "Juan Pérez",
    "phone": "+50376008682",
    "message": "Hola, quiero info sobre propiedades en El Zonte",
    "interest_type": "real_estate"
  }'
```

## Comandos de despliegue

```bash
# Desplegar la función
supabase functions deploy botpress-webhook

# Configurar el secreto del webhook
supabase secrets set BOTPRESS_WEBHOOK_SECRET=<genera-un-valor-seguro-aqui>

# Probar localmente
supabase start
supabase functions serve botpress-webhook --env-file .env.local
```
