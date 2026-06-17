---
name: supabase-schema-conventions
description: Convenciones de esquema y RLS de este proyecto; usar siempre que se cree una migración o tabla nueva.
paths: supabase/**
---

# Supabase Schema Conventions — Sunrise CRM

## Nombre de archivos de migración

Formato obligatorio: `YYYYMMDDHHMMSS_descripcion_corta.sql`

Ejemplo: `20260616120000_create_clients_table.sql`

- **Nunca editar una migración ya aplicada** — crear una nueva con `alter table` si se necesita cambiar.
- Una migración por cambio lógico (no empaquetar múltiples cambios no relacionados en un mismo archivo).

## Convenciones de tablas

- Nombres en **snake_case y plural**: `clients`, `pipeline_stages`, `client_comments`, `stage_history`, `messages`, `profiles`.
- Toda tabla debe tener `created_at timestamptz not null default now()`.
- PKs: `uuid primary key default gen_random_uuid()` — excepción: `profiles` usa `id uuid primary key references auth.users(id)`.
- FKs con `on delete cascade` cuando el registro hijo no tiene sentido sin el padre (ej. `client_comments` → `clients`).
- Columnas opcionales van sin `not null`.

## RLS — Row Level Security

**Regla de oro: habilitar RLS en TODAS las tablas, sin excepción.**

```sql
alter table nombre_tabla enable row level security;
```

### Políticas base (usuarios autenticados)

```sql
create policy "Authenticated users can select"
  on nombre_tabla for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert"
  on nombre_tabla for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update"
  on nombre_tabla for update
  using (auth.uid() is not null);
```

### Políticas avanzadas (a agregar en migraciones futuras si se requiere)

- Solo `admin` puede borrar etapas del pipeline.
- Solo el agente asignado o un `admin` puede actualizar ciertos campos del cliente.

### Edge Functions y service_role

La Edge Function `botpress-webhook` usa `SUPABASE_SERVICE_ROLE_KEY` (disponible automáticamente en el runtime de Deno) para bypasear RLS. **Nunca exponer esta clave en el frontend.**

## Tablas actuales del proyecto

| Tabla               | Descripción                                              |
|---------------------|----------------------------------------------------------|
| `profiles`          | Usuarios internos (agentes); extiende `auth.users`       |
| `pipeline_stages`   | Etapas configurables del embudo de ventas                |
| `clients`           | Leads/clientes captados por cualquier canal              |
| `client_comments`   | Notas internas del equipo sobre un cliente               |
| `stage_history`     | Auditoría de movimientos entre etapas del pipeline       |
| `messages`          | Log crudo de mensajes entrantes/salientes desde Botpress |

## Tipos TypeScript

Mantener `apps/web/src/types/database.ts` sincronizado con las migraciones. Para regenerar desde Supabase CLI:

```bash
supabase gen types typescript --local > apps/web/src/types/database.ts
```

Cuando no hay Supabase CLI disponible, mantener los tipos escritos a mano en ese archivo siguiendo el esquema real.
