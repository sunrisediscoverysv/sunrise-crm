# Deploy y prueba — Bandeja de conversaciones (WhatsApp bidireccional)

Guía para poner en producción el chat bidireccional del CRM (`/inbox` + chat en la
ficha del cliente) y validarlo de punta a punta.

Proyecto Supabase linkeado: `hossxvizztnvldoibnrh`.

## 1. Deploy backend

Ejecutar desde `sunrise-crm/`:

```bash
# (opcional) confirmar que estás en el proyecto correcto
supabase projects list

# 1. Aplicar la migración nueva (agrega clients.agent_last_read_at) — cambio aditivo, sin riesgo
supabase db push

# 2. Desplegar la Edge Function whatsapp (ahora incluye la acción 'text')
supabase functions deploy whatsapp

# 3. Confirmar que están los secretos de Meta
supabase secrets list
#   Deben existir: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID
#   Si falta el token:
#   supabase secrets set WHATSAPP_TOKEN=EAAG...   (token permanente de la app de Meta)
```

## 2. Deploy frontend

El frontend se despliega **solo por merge a `main`** (no `vercel` manual). Abrir PR
con los cambios y mergear cuando el preview se vea bien.

## 3. Prueba de punta a punta

### A. Recibir (inbound) + realtime
1. Desde un teléfono real, enviar un WhatsApp al número del negocio.
2. En el CRM → **Conversaciones** (`/inbox`): la conversación debe aparecer/subir al
   tope **sin recargar**, con el punto de "no leído".
3. Abrir la conversación → el punto de no leído desaparece.

### B. Responder con texto (ventana de 24h abierta)
1. Con el cliente que acaba de escribir (ventana abierta), escribir una respuesta en
   el compositor y enviar (Enter).
2. Verificar: aparece la burbuja saliente, llega al WhatsApp del cliente, y abajo se
   ve "Ventana de 24h abierta · quedan Xh Ym".

### C. Ventana cerrada → plantilla
- Caso fácil (sin esperar 24h): abrir una conversación de un cliente que **nunca ha
  escrito** o cuyo último mensaje entrante es de hace >24h. El compositor debe estar
  **bloqueado** y mostrar el botón **"Enviar plantilla"**.
- Enviar una plantilla aprobada → llega al cliente y queda registrada como saliente.
- (El rechazo real de Meta por >24h — error 131047 — también está manejado: la función
  responde 409 y la UI muestra el aviso para usar plantilla.)

### D. Responsive (el cliente usa mucho el móvil)
- En pantalla de teléfono: `/inbox` muestra solo la **lista**; al tocar una conversación
  pasa al **hilo** con flecha "volver". En escritorio se ven los dos paneles a la vez.

## Nota (Chatwoot en paralelo)
Las respuestas escritas **desde Chatwoot** no se reflejan en el hilo del CRM (Botpress
solo reenvía los entrantes). Recomendado: atender desde el CRM y responder solo a los
clientes asignados para evitar respuestas duplicadas.
