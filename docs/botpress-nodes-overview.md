# Botpress — Mapa de nodos custom (recuperación)

Botpress **no se versiona automáticamente** en este repo. Este documento es el mapa
de todas las piezas de código personalizadas del bot, para poder reconstruirlas si
Botpress vuelve a perder una versión. Guarda aquí cualquier cambio que hagas en Studio.

> Restaurar en Botpress: menú **Versions** (ícono de reloj 🕐, barra izquierda) → elegir
> una versión anterior → **Restore**. Botpress guarda una versión por cada *publish*,
> pero el historial es limitado (3 en Pay-as-you-go, 15 en Team), así que **commitea aquí**.

## Flujo general
```
WhatsApp/IG/Messenger/Web → Chatwoot → Botpress (integración michaelbarney/chatwoot)
   → nodo autónomo "Agente_ventas"
        ├─ tool isAgentAssigned()  → ¿ya hay agente humano? → si sí, End1 (bot calla)
        ├─ tool phoneAssigned()    → precarga el teléfono del usuario
        └─ captura datos (nombre, teléfono, email, presupuesto, interés)
   → nodo "Hubspot_mandardatos" (card "Execute Code")
        ├─ envía el lead al CRM (Supabase Edge Function botpress-webhook)
        └─ si es WhatsApp: asigna agente en Chatwoot por rotación + mensaje de handoff
```

## Piezas y dónde están respaldadas

| Pieza | Tipo | Backup en repo |
|-------|------|----------------|
| Envío de datos al CRM + asignación de agente | card "Execute Code" | [botpress-execute-code.js](botpress-execute-code.js) |
| `isAgentAssigned` (¿hay agente humano?) | Tool (input/output schema) | [botpress-isagentassigned.js](botpress-isagentassigned.js) |
| `phoneAssigned` (precarga teléfono) | Tool | ⚠️ **NO respaldado** — reconstruir si se pierde |
| Nodo autónomo `Agente_ventas` | Autonomous node (LLMZ) | Instrucciones + patrón abajo (el código lo genera el LLM por turno) |
| Contador de rotación seguro | RPC en Supabase | `supabase/migrations/20260618130000_app_config_rotation_rpc.sql` |

## Patrón del nodo autónomo `Agente_ventas`
El nodo autónomo genera su código por turno, pero el patrón estable es:

```typescript
// Siempre verificar si hay agente humano antes de responder
const agentStatus = await isAgentAssigned({})
if (agentStatus.assigned) {
  return { action: 'End1' }       // hay humano atendiendo → el bot no responde
}

// Precargar teléfono del usuario (si aplica)
await phoneAssigned({})

// ... capturar datos y/o saludar ...
return { action: 'listen' }
```

## Variables de workflow que usa el flujo
| Variable | La produce | La consume |
|----------|-----------|-----------|
| `workflow.assigned` | isAgentAssigned | nodo autónomo (frenar bot) |
| `workflow.chatwootConvId` | isAgentAssigned | Execute Code (asignar agente) |
| `workflow.user_Name` (req) | nodos de captura | Execute Code |
| `workflow.user_Phone` (req) | nodos de captura | Execute Code |
| `workflow.user_Email` | nodos de captura | Execute Code |
| `workflow.user_Budget` | nodos de captura | Execute Code |
| `workflow.user_Interest` | nodos de captura | Execute Code (mapea a real_estate/construction/concierge) |
| `workflow.userId` | evento | Execute Code (channel_user_id) |

## Credenciales (hardcoded como respaldo en los nodos)
- Chatwoot: account `169032`, token `zH2WXa3U2WCBccTVzPH6cw2p`, agentes `[184155, 182328]`
- Supabase: `https://hossxvizztnvldoibnrh.supabase.co`, llave anon (pública)
- Webhook del CRM: `secret = 'sunrise2026bp'`

> Pendiente de seguridad (opcional): mover estas credenciales a variables de workflow
> en Botpress en vez de tenerlas en el código.
