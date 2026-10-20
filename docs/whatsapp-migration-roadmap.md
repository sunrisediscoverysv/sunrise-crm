# Roadmap — Migración de Chatwoot a WhatsApp Cloud API directo en el CRM

> **Objetivo:** eliminar Chatwoot y que el **CRM (Supabase + React)** sea el intermediario
> directo entre **WhatsApp Cloud API** y **Botpress**, incluyendo una bandeja mínima para
> que los asesores continúen el chat en vivo con el cliente.
>
> **Motivo / urgencia:** Chatwoot dejó de ser usable sin plan pagado.
>
> **Escala objetivo:** ~100 usuarios concurrentes en pico (Supabase Realtime lo soporta sin problema).

---

## Arquitectura objetivo

```
                 (webhook entrante)              (push mensaje)
WhatsApp Cloud API ───────────────► CRM hub (Edge Functions) ───────► Botpress (IA)
        ▲                                  │   ▲                          │
        │       (envío salida)             │   └──────────────────────────┘
        └──────────────────────────────────┘        (respuesta del bot)
                                           │
                                           ├──► Postgres: conversations / messages
                                           │
                                           └──► Supabase Realtime ──► Bandeja de agentes (React)
```

Regla dura de Meta: **un número de WhatsApp solo puede estar conectado a UNA app/BSP a la vez.**
Por eso el CRM pasa a ser el único punto de entrada (webhook de Meta) y orquesta a Botpress y a los asesores.

---

## Qué se construye y qué NO

**Se construye (4 piezas):**
1. Conexión WhatsApp Cloud API (entrada + salida), incl. ventana de 24h y plantillas.
2. Puente CRM ↔ Botpress (empujar mensaje del cliente, recibir respuesta del bot).
3. Bandeja **mínima** de agentes en el CRM (lista + hilo + responder, en tiempo real).
4. Estado de asignación + silencio del bot (reusar la rotación atómica ya existente).

**NO se construye (confirmado que no se usa en Chatwoot):**
etiquetas, CSAT, respuestas rápidas/canned, reportes, multi-buzón. Fuera de alcance.

---

## Fase 0 — Prerrequisitos en Meta (bloqueante, empezar YA por los tiempos de aprobación)

- [ ] WhatsApp Business Account (WABA) dentro del **Meta Business Manager** existente (`info@sunrisediscovery.com`).
- [ ] App en **Meta for Developers** con el producto **WhatsApp** agregado.
- [ ] **System User** + **token de acceso permanente** (no usar el token temporal de 24h).
- [ ] **Número de pruebas** gratuito de Meta para desarrollar sin tocar el productivo.
- [ ] **Verify token** y **App Secret** (para validar la firma `X-Hub-Signature-256`).
- [ ] Enviar a aprobación al menos **1 plantilla de reapertura** (para escribir fuera de la ventana de 24h). La aprobación de Meta puede tardar de horas a días.

**Riesgo principal:** la migración del **número productivo**. Hoy vive en el BSP de Chatwoot;
para conectarlo a Cloud API hay que **liberarlo del BSP actual** y registrarlo en Meta. Es un
corte coordinado (ver Fase 7). Alternativa de menor riesgo: usar un **número nuevo** en Cloud
API y cambiar el número en webs/redes (cambia el número público, pero evita ventana de corte).

---

## Fase 1 — Modelo de datos (Supabase / Postgres)

Tablas nuevas (enlazan al `contacts`/`leads` existente):

```
conversations
  id, channel ('whatsapp'|'instagram'|...), channel_user_id (wa_id / teléfono),
  contact_id (FK), status ('bot'|'assigned'|'closed'),
  assigned_agent_id (FK), last_inbound_at (timestamptz)  -- clave para la ventana 24h,
  last_message_at, unread_count, created_at, updated_at

messages
  id, conversation_id (FK), direction ('inbound'|'outbound'),
  sender_type ('customer'|'bot'|'agent'|'system'),
  wa_message_id (único, para idempotencia), type ('text'|'image'|'audio'|'document'|'template'),
  text, media_url, status ('queued'|'sent'|'delivered'|'read'|'failed'),
  metadata jsonb, created_at
```

- [ ] RLS: asesor ve sus conversaciones asignadas + sin asignar; admin ve todo.
- [ ] Publicación de **Realtime** en `messages` y `conversations`.
- [ ] Índices: `conversations(channel_user_id)`, `messages(conversation_id, created_at)`, único `messages(wa_message_id)`.

---

## Fase 2 — Pipeline de ENTRADA (Edge Function `whatsapp-webhook`)

- [ ] `GET`: verificación del webhook de Meta (responder `hub.challenge` con el verify token).
- [ ] `POST`: validar firma `X-Hub-Signature-256` con el App Secret.
- [ ] Parsear payload de Meta → **upsert** de `conversations` por `wa_id` → insertar `message` entrante → actualizar `last_inbound_at`.
- [ ] **Idempotencia:** ignorar si `wa_message_id` ya existe (Meta reintenta webhooks).
- [ ] **Ruteo:**
  - `status == 'assigned'` → NO llamar a Botpress; solo guardar + emitir a la bandeja por Realtime.
  - en otro caso → enviar a Botpress (Fase 3) para obtener respuesta del bot.
- [ ] **Media entrante:** los URLs de media de Meta expiran; descargar con el token y guardar en **Supabase Storage**, luego referenciar en `media_url`.

---

## Fase 3 — Puente CRM ↔ Botpress

- [ ] Definir el canal: usar la **Chat API / canal Webhook** de Botpress Cloud (el CRM envía el
      mensaje del cliente a la conversación de Botpress y Botpress responde a un endpoint del CRM).
- [ ] Mapear `wa_id` ↔ conversación/usuario de Botpress.
- [ ] **Pasar el contexto de origen** que el prompt de "Sol" necesita (plataforma: whatsapp/web/ig/fb;
      sección: home/real-estate/construction/concierge; propiedad específica si aplica).
- [ ] Respuesta del bot → `whatsapp-send` (Fase 4) → guardar `message` saliente (`sender_type='bot'`).
- [ ] El webhook de leads actual (`botpress-webhook`) **se mantiene**: Botpress sigue empujando los
      datos del lead (nombre, presupuesto, teléfono, email).

---

## Fase 4 — Pipeline de SALIDA (Edge Function `whatsapp-send`)

- [ ] Enviar **texto libre** cuando `now - last_inbound_at < 24h`.
- [ ] Enviar **plantilla aprobada** cuando está fuera de la ventana de 24h.
- [ ] Manejo de media saliente.
- [ ] **Callbacks de estado** de Meta (sent/delivered/read/failed) → actualizar `messages.status`.
- [ ] Reintentos y manejo de rate limits / errores de la API.

---

## Fase 5 — Bandeja de agentes (React, `apps/web`)

- [ ] **Lista de conversaciones**: filtros (mías / sin asignar / todas), badge de no leídos, orden por `last_message_at`.
- [ ] **Hilo**: burbujas por `sender_type` (cliente / bot / asesor), timestamps, ticks de entrega/lectura, render de media.
- [ ] **Composer**: texto libre; si está **fuera de la ventana de 24h**, deshabilitar texto y ofrecer selector de **plantilla**.
- [ ] **Realtime**: suscripción a `messages` y `conversations` (`supabase.channel`), con reconexión.
- [ ] Controles de **tomar / soltar** conversación (asignar a mí, devolver al bot).
- [ ] Respeta tokens de marca (Outfit, `brand.*`) ya definidos en el design system.

---

## Fase 6 — Asignación + silencio del bot

- [ ] Reusar el **contador de rotación atómico** ya existente en Supabase.
- [ ] Al completarse el lead (o "tomar" manualmente) → `status='assigned'`, set `assigned_agent_id`.
- [ ] Reescribir `isAgentAssigned()` de Botpress para que **consulte el CRM** (Edge Function) según
      `conversations.status`, en vez de Chatwoot. Mientras `assigned`, el bot calla.
- [ ] Acción para **devolver al bot** (cerrar / reabrir).

---

## Fase 7 — Migración y cutover

- [ ] End-to-end completo sobre el **número de pruebas** de Meta.
- [ ] **Run en paralelo:** Chatwoot sigue con el número productivo hasta que la bandeja nueva esté probada.
- [ ] **Migración del número productivo** a Cloud API (liberarlo del BSP de Chatwoot → registrarlo en Meta).
      Hacerlo en **horario de baja demanda**; prever una ventana de corte por el registro/OTP.
- [ ] Smoke test productivo (entrante, respuesta del bot, handoff, respuesta del asesor, estados).
- [ ] **Apagar Chatwoot** y cancelar el plan.

---

## Fase 8 — Endurecimiento / observabilidad

- [ ] Logging estructurado y **dead-letter** para envíos fallidos.
- [ ] Monitoreo de fallos de webhook y del **quality rating** del número en Meta.
- [ ] Respaldo del historial de mensajes.
- [ ] Cola de reintentos para envíos.

---

## Estimación de esfuerzo (1 desarrollador, orientativa)

| Fase | Trabajo | Tiempo |
|------|---------|--------|
| 0 | Setup Meta + plantillas (mayormente espera de aprobación) | 0.5–1 sem |
| 1 | Modelo de datos + RLS + Realtime | 0.5 sem |
| 2 | Edge Function entrante | 0.5–1 sem |
| 3 | Puente Botpress (la incógnita) | 1–1.5 sem |
| 4 | Edge Function salida + estados | 0.5–1 sem |
| 5 | Bandeja de agentes (lo más pesado) | 1.5–2 sem |
| 6 | Asignación + silencio del bot | 0.5 sem |
| 7 | Migración y cutover | 0.5 sem + esperas |
| 8 | Endurecimiento | continuo |

**Total:** ~5–7 semanas para la versión completa; un **MVP funcional** (entrante + bot + bandeja básica
+ salida con texto) puede salir en **~3 semanas** si se recortan plantillas avanzadas y media.

---

## Stopgap mientras se construye

Para **no perder operación hoy**: el camino más barato suele ser pagar el **tier mínimo de Chatwoot
1–2 meses** como puente mientras se construye y prueba la bandeja nueva — es casi seguro más barato
que apurar el corte y arriesgar la operación de WhatsApp. El corte de Chatwoot se hace recién en la Fase 7.

---

## Riesgos y dependencias clave

1. **Migración del número** (Fase 7): el mayor riesgo; un número vive en una sola plataforma a la vez.
   Mitigación: probar todo con número de pruebas y/o evaluar número nuevo.
2. **Ventana de 24h + aprobación de plantillas**: empezar la aprobación en Fase 0 por los tiempos de Meta.
3. **Puente Botpress** (Fase 3): confirmar temprano qué API/canal de Botpress Cloud se usará.
4. **Media entrante**: los URLs de Meta expiran → descargar y guardar en Supabase Storage.
5. **Confiabilidad del Realtime**: orden de mensajes, reconexión y recibos en la bandeja (Fase 5).

---

# Fase 2 — IA interna (post-Botpress)

> **Objetivo:** una vez completada la migración Chatwoot→CRM, reemplazar **Botpress** por una
> IA propia que el CRM invoca vía API, manteniendo WhatsApp y la bandeja sin cambios.
>
> **Cuándo:** proyecto **aparte**, después de estabilizar y probar la Fase 1. No mezclar ambas migraciones.

## Principio de diseño: abstracción del puente

El puente CRM↔Botpress (Fase 3 de arriba) se construye detrás de una interfaz, no acoplado a Botpress:

```
interface AgentProvider {
  getReply(conversation): Promise<{ text, leadFields?, assignAgent? }>
}
```

- **Hoy:** `BotpressProvider` (reenvía el mensaje a Botpress y devuelve la respuesta).
- **Fase 2:** se agrega `ClaudeProvider` y se cambia un flag por canal/conversación. WhatsApp, la
  bandeja y el modelo de datos **no se tocan** — solo se intercambia el cerebro.

## Arquitectura objetivo

```
WhatsApp Cloud API ⇄ CRM (hub) ──► AgentProvider
                                      ├─ ClaudeProvider  ──► API de Claude (Anthropic SDK)
                                      │     ├─ system prompt "Sol" (desde app_config)
                                      │     ├─ historial (tabla messages)
                                      │     ├─ tool use: captura de lead + asignación
                                      │     └─ RAG: pgvector (Supabase) + catálogo Webflow
                                      └─ BotpressProvider (legacy, se retira)
```

## Componentes a construir

1. **Cliente de Claude en una Edge Function.**
   - Modelo por defecto: **Claude Opus 4.8** (`claude-opus-4-8`). Rutas simples/alto volumen pueden
     bajar a **Sonnet 4.6** (`claude-sonnet-4-6`) o **Haiku 4.5** (`claude-haiku-4-5`) por costo — decisión de negocio.
   - **Prompt caching** sobre el system prompt de "Sol" + el bloque de KB → costo por turno mínimo.
   - El system prompt vive en **`app_config`** (tabla editable desde `/settings`), para que marketing
     lo ajuste sin tocar código (reemplaza el editor visual de Botpress).

2. **Orquestación de la conversación.**
   - Construir el request con: system prompt + historial de `messages` + **tool use**.
   - **Tools (function calling):** `save_lead_field` (nombre/presupuesto/teléfono/email) y `assign_agent`
     (dispara la rotación atómica ya existente).
   - **La compuerta de validación pasa a ser código:** el lead solo se cierra cuando las 4 variables
     están llenas y verificadas en el servidor — garantía técnica, no dependiente del prompt.

3. **Base de conocimiento (RAG) — el único trabajo realmente nuevo.**
   - Habilitar **pgvector** en Supabase (sin infraestructura adicional).
   - Embeber: catálogo de propiedades (**ya sincronizado desde Webflow**), servicios de construcción y concierge.
   - Por turno: recuperar los chunks relevantes (búsqueda vectorial) e inyectarlos en el prompt.
   - Regla de negocio existente: nunca inventar datos no confirmados (precios, tamaños, disponibilidad).

4. **Retiro de Botpress.**
   - Migrar conversaciones a `ClaudeProvider` por fases (canary por canal o por sección).
   - Validar paridad (captura de lead, handoff, tono de "Sol") y dar de baja Botpress.

## Qué se gana / qué se cede

**Gana:** una dependencia SaaS menos, control total de prompt/tools/grounding, validación del lead
garantizada por código, costo bajo con caching, y todo en un solo modelo de datos.

**Cede:** el editor visual de Botpress → mitigado guardando el system prompt en `app_config`.

## Riesgos / notas

- **Calidad del RAG** es donde se va el esfuerzo nuevo (chunking, embeddings, recuperación, evals).
- Mantener un set de **evaluación** del agente "Sol" antes de cortar Botpress (paridad de comportamiento).
- La integración con la API de Claude es directa; modelo y caching ya documentados en la skill `claude-api`.
```
