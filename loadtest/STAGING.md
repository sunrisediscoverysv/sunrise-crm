# Entorno de staging para pruebas de carga

Objetivo: un clon de la base de datos + webhook donde probar carga **sin tocar producción**.

## Lo que solo tú puedes hacer (dashboard de Supabase)

1. **Crear el proyecto de staging**
   - https://supabase.com/dashboard → New project (misma organización).
   - Nómbralo `sunrise-crm-staging`. Anota el **project ref** (lo verás en la URL/Settings).
   - Región: la misma que producción (`us-west-2`) para que la latencia sea comparable.

2. **Configurar las variables/secretos de la Edge Function en staging**
   - El `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase solo.
   - El secreto del webhook lo defines tú (cualquier valor para staging):
     ```bash
     npx supabase secrets set BOTPRESS_WEBHOOK_SECRET=<secret-staging> --project-ref <ref-staging>
     ```
   - (Opcional) NO configures `RESEND_API_KEY`/`NOTIFICATION_EMAIL` en staging, así no manda correos reales durante la prueba.

## Lo que automatiza el script

Con el ref ya creado:

```bash
STAGING_REF=<ref-staging> ./scripts/deploy-staging.sh
```

Esto aplica las migraciones (incluidos los índices) y despliega el webhook a staging,
y al final vuelve a enlazar producción para que no quedes apuntando a staging.

## Correr la prueba

Ver [README.md](./README.md). Para tu escala real (~100 personas a la vez), un pico
de ~100 VUs es representativo:

```bash
k6 run --vus 100 --duration 30s \
  -e WEBHOOK_URL="https://<ref-staging>.supabase.co/functions/v1/botpress-webhook" \
  -e WEBHOOK_SECRET="<secret-staging>" \
  loadtest/webhook-load.js
```

## (Opcional) Botpress de staging

Si quieres probar el flujo completo end-to-end, duplica el bot en Botpress y apunta su
webhook al endpoint de staging. Para medir solo Supabase, el script de k6 ya pega
directo al webhook sin pasar por Botpress.
