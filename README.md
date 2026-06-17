# Sunrise Discovery CRM

CRM interno para Sunrise Discovery (El Salvador) — centraliza leads de WhatsApp, Instagram, Facebook Messenger y chat web en un pipeline Kanban con integración automática vía Botpress.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Routing | React Router v6 |
| Data fetching | TanStack Query v5 |
| Drag-and-drop | @hello-pangea/dnd |
| Backend / DB | Supabase (Postgres + Auth + Realtime) |
| Webhook | Supabase Edge Function (Deno/TypeScript) |
| Hosting | Vercel (frontend) + Supabase (managed) |

---

## Requisitos previos

- **Node.js 20+** y npm
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** (`npm i -g supabase`)
- Proyecto creado en [supabase.com](https://supabase.com)
- (Opcional) Docker Desktop — solo necesario para desarrollo local con Supabase

---

## Instalación local

```bash
# 1. Clonar el repo
git clone <repo-url>
cd sunrise-crm

# 2. Instalar dependencias del frontend
cd apps/web
npm install

# 3. Variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores de tu proyecto Supabase
# (Project Settings → API → Project URL y anon key)

# 4. Iniciar el servidor de desarrollo
npm run dev
# → http://localhost:5173
```

### Desarrollo con Supabase local (opcional)

Requiere Docker Desktop corriendo.

```bash
# Desde la raíz del repo (donde está /supabase)
supabase start          # Levanta Postgres, Auth, Storage, Studio
supabase db reset       # Aplica migraciones + seed en una sola operación

# Studio local disponible en http://localhost:54323
# API local en http://localhost:54321

# Para VITE_SUPABASE_URL usa http://localhost:54321
# Para VITE_SUPABASE_ANON_KEY usa el valor que imprime `supabase status`
```

---

## Base de datos (Supabase en la nube)

### Primera vez — proyecto nuevo

```bash
# 1. Vincular el CLI con tu proyecto remoto
supabase link --project-ref <project-ref>

# 2. Aplicar todas las migraciones
supabase db push

# 3. Cargar las etapas del pipeline iniciales
supabase db seed --db-url "postgresql://postgres.<project-ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### Añadir una migración nueva

```bash
supabase migration new <nombre-descriptivo>
# Editar el archivo generado en supabase/migrations/
supabase db push
```

### Regenerar tipos TypeScript

Después de cualquier cambio en el esquema:

```bash
supabase gen types typescript --linked > apps/web/src/types/database.ts
```

---

## Edge Function — Webhook de Botpress

La función recibe los leads de Botpress y los registra en el CRM automáticamente.

```bash
# Desplegar la función
supabase functions deploy botpress-webhook

# Configurar el secreto (se genera una sola vez, nunca va al repo)
supabase secrets set BOTPRESS_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Ver secretos actuales
supabase secrets list
```

El endpoint queda disponible en:
```
POST https://<project-ref>.supabase.co/functions/v1/botpress-webhook
```

Ver [docs/botpress-integration.md](docs/botpress-integration.md) para la guía completa de configuración en Botpress Studio, incluyendo el payload esperado y ejemplos de código.

### Prueba rápida del webhook

```bash
curl -i -X POST https://<project-ref>.supabase.co/functions/v1/botpress-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <tu-secreto>" \
  -d '{
    "channel": "whatsapp",
    "channel_user_id": "50376000001",
    "full_name": "María García",
    "phone": "+50376000001",
    "message": "Hola, quiero info sobre propiedades en La Libertad",
    "interest_type": "real_estate"
  }'
# Respuesta esperada: {"status":"ok","client_id":"<uuid>"}
```

---

## Deploy en Vercel

### Primera vez

1. Conectar el repositorio en [vercel.com](https://vercel.com/new)
2. Configurar el proyecto:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Agregar las variables de entorno en Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Hacer deploy.

### Deploys automáticos

Cualquier push a `main` despliega automáticamente. Las pull requests generan preview URLs.

### Build manual

```bash
cd apps/web
npm run build     # genera apps/web/dist/
npm run preview   # sirve el build localmente para verificar
```

---

## Variables de entorno

| Variable | Dónde se configura | Descripción |
|----------|-------------------|-------------|
| `VITE_SUPABASE_URL` | `apps/web/.env.local` y Vercel | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `apps/web/.env.local` y Vercel | Clave anónima pública (segura en frontend) |
| `BOTPRESS_WEBHOOK_SECRET` | `supabase secrets set` | Secreto compartido con Botpress — **nunca en el repo** |

> `BOTPRESS_WEBHOOK_SECRET` se almacena como un Supabase Secret y la Edge Function lo lee vía `Deno.env.get('BOTPRESS_WEBHOOK_SECRET')`. La clave de servicio (`service_role`) nunca sale de la Edge Function.

---

## Seguridad

- **RLS habilitado** en las 6 tablas: `profiles`, `pipeline_stages`, `clients`, `client_comments`, `stage_history`, `messages`
- El frontend usa exclusivamente la `anon key` — no tiene acceso a la `service_role key`
- La Edge Function usa la `service_role key` (inyectada automáticamente por Supabase) para saltarse RLS al registrar leads desde Botpress
- Las rutas `/settings` solo son accesibles a usuarios con `role = 'admin'`
- El webhook valida el header `x-webhook-secret` antes de procesar cualquier payload

---

## Estructura del proyecto

```
sunrise-crm/
├── .claude/skills/                  # Context skills para Claude Code
│   ├── sunrise-design-system/       # Tokens de marca extraídos de sunrisediscovery.com
│   ├── supabase-schema-conventions/ # Convenciones de migraciones y RLS
│   └── botpress-webhook-contract/   # Spec del payload del webhook
├── apps/web/                        # Frontend React + Vite
│   ├── src/
│   │   ├── components/              # UI compartido (Button, Input, Badge, Avatar…)
│   │   ├── features/
│   │   │   ├── auth/                # AuthContext, LoginPage
│   │   │   ├── pipeline/            # Kanban con DnD
│   │   │   ├── clients/             # Listado, filtros, detalle, mensajes, comentarios
│   │   │   ├── dashboard/           # Métricas y resumen
│   │   │   └── settings/            # Admin: etapas del pipeline y equipo
│   │   ├── hooks/                   # useClients, usePipelineStages, useProfiles
│   │   ├── lib/
│   │   │   ├── supabaseClient.ts    # Cliente Supabase tipado
│   │   │   └── mutations.ts         # Helpers de mutación — único punto de casteo
│   │   └── types/database.ts        # Tipos generados del esquema Supabase
│   ├── .env.example
│   └── package.json
├── supabase/
│   ├── migrations/                  # Una migración SQL por cambio de esquema
│   │   ├── 20260616120000_create_profiles.sql
│   │   ├── 20260616120001_create_pipeline_stages.sql
│   │   ├── 20260616120002_create_clients.sql
│   │   ├── 20260616120003_create_client_comments.sql
│   │   ├── 20260616120004_create_stage_history.sql
│   │   └── 20260616120005_create_messages.sql
│   ├── functions/
│   │   └── botpress-webhook/        # Edge Function (Deno)
│   ├── seed.sql                     # 7 etapas del pipeline iniciales
│   └── config.toml
└── docs/
    └── botpress-integration.md      # Guía completa de configuración en Botpress Studio
```

---

## Módulos del CRM

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/login` | Público | Autenticación email + contraseña |
| `/dashboard` | Todos | Métricas: leads totales, ganados, nuevos 7d, por etapa |
| `/pipeline` | Todos | Kanban drag-and-drop con Realtime |
| `/clients` | Todos | Listado con filtros por canal, etapa, agente y fechas |
| `/clients/:id` | Todos | Detalle: contacto, mensajes Botpress, comentarios internos, Realtime |
| `/settings` | Solo admin | Gestión de etapas del pipeline y lista de usuarios |

---

## Flujo de un nuevo lead

```
Usuario escribe en WhatsApp/IG/Messenger
        ↓
    Botpress captura datos del formulario
        ↓
    POST /functions/v1/botpress-webhook
        ↓
    Edge Function valida secreto
        ↓
    upsert en `clients` (channel + channel_user_id como clave única)
    insert en `messages`
        ↓
    Supabase Realtime notifica al frontend
        ↓
    Lead aparece en el Kanban sin recargar la página
```

---

## Checklist de producción

- [ ] `supabase db push` aplicado al proyecto remoto
- [ ] `supabase db seed` corrido con las 7 etapas iniciales
- [ ] `BOTPRESS_WEBHOOK_SECRET` configurado con `supabase secrets set`
- [ ] `supabase functions deploy botpress-webhook` ejecutado
- [ ] Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en Vercel
- [ ] Primer usuario admin creado en Supabase Auth → tabla `profiles` con `role = 'admin'`
- [ ] Webhook configurado en Botpress Studio apuntando al endpoint de producción
- [ ] Prueba de punta a punta: mensaje en WhatsApp → lead aparece en el CRM

---

## Primer usuario administrador

Supabase Auth gestiona las cuentas. Después de crear el primer usuario:

1. Ir a Supabase → Table Editor → `profiles`
2. Buscar la fila del usuario creado
3. Cambiar `role` de `agente` a `admin`

El trigger `handle_new_user()` crea automáticamente la fila en `profiles` con `role = 'agente'` al registrarse.

---

## Desarrollo

```bash
# Servidor de desarrollo con hot reload
cd apps/web && npm run dev

# Type-check sin compilar
cd apps/web && npx tsc --noEmit

# Probar Edge Function localmente
supabase functions serve botpress-webhook --env-file supabase/.env.local
```
