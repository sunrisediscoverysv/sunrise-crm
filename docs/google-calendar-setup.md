# Conectar Google Calendar al CRM

El CRM ya trae el código para sincronizar las citas con el Google Calendar de
cada agente (botón **Conectar Google Calendar** en la página de Calendario).
Para que funcione hay que crear credenciales en Google Cloud una sola vez y
cargarlas como *secrets* de Supabase.

## 1. Crear el proyecto y habilitar la API

1. Entra a <https://console.cloud.google.com/> con la cuenta de Sunrise.
2. Crea un proyecto (o usa uno existente), ej. **Sunrise CRM**.
3. Menú → **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.

## 2. Pantalla de consentimiento OAuth

1. **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** → Crear.
3. Nombre de la app: *Sunrise CRM*; correo de asistencia: `info@sunrisediscovery.com`.
4. En **Alcances (scopes)** agrega:
   - `.../auth/calendar.events`
   - `openid`, `email`
5. En **Usuarios de prueba** agrega los correos de los agentes que van a conectar
   su calendario (mientras la app esté en modo "Testing"). Si luego la publicas,
   ya no hace falta.

## 3. Crear las credenciales OAuth

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo: **Aplicación web**.
3. **URIs de redireccionamiento autorizados** → agrega exactamente:

   ```
   https://hossxvizztnvldoibnrh.supabase.co/functions/v1/google-oauth
   ```

4. Crea y copia el **Client ID** y el **Client secret**.

## 4. Cargar los secrets en Supabase

Desde la carpeta `sunrise-crm/`:

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID="TU_CLIENT_ID" \
  GOOGLE_CLIENT_SECRET="TU_CLIENT_SECRET" \
  APP_URL="https://sunrise-crm-drab.vercel.app"
```

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase
> automáticamente en las Edge Functions; no hay que setearlos.

## 5. Desplegar las funciones y la migración

```bash
supabase functions deploy google-oauth
supabase functions deploy google-calendar-sync
supabase db push        # crea google_calendar_tokens + appointments.google_event_id
```

## 6. Usar

1. En el CRM → **Calendario** → botón **Conectar Google Calendar**.
2. El agente autoriza su cuenta de Google y vuelve al CRM (`?google=connected`).
3. A partir de ahí, cada cita que cree/edite/elimine se refleja en su Google
   Calendar, y la cita sigue guardada en el sistema como siempre.

## Notas

- La conexión es **por agente**: cada quien conecta su propio Google Calendar.
- El sync es *best-effort*: si Google falla o el agente no está conectado, la
  cita igual se guarda en el CRM (no se bloquea el flujo).
- Los eventos se crean en el calendario **primario** de la cuenta conectada.
