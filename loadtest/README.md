# Pruebas de carga — Sunrise CRM

Prepara el CRM para picos de tráfico (campañas que generan muchos leads/chats a la vez).

## ⚠️ Regla de oro: solo en staging

**Nunca correr estas pruebas contra producción.** Generan miles de registros de prueba.
Crea un proyecto Supabase de staging (o una rama de base de datos) y despliega ahí la
Edge Function y las migraciones antes de probar.

## Requisitos

- [k6](https://k6.io/docs/get-started/installation/) (`brew install k6`)
- URL y secreto del webhook **de staging**.

## Cómo correr

```bash
k6 run \
  -e WEBHOOK_URL="https://<staging-ref>.supabase.co/functions/v1/botpress-webhook" \
  -e WEBHOOK_SECRET="<secret-de-staging>" \
  loadtest/webhook-load.js
```

## Qué observar

1. **Resultado de k6**
   - `http_req_failed` debe quedar por debajo de 1%.
   - `http_req_duration p(95)` por debajo de ~800ms.
   - El check `burst: sin 500` debe pasar al 100% (valida la corrección de la
     condición de carrera al crear leads simultáneos).

2. **Dashboard de Supabase → Reports** (durante la corrida)
   - CPU y memoria de la base de datos.
   - Conexiones activas (si se saturan, es señal de que falta el connection pooler / subir de plan).
   - Invocaciones y errores de la Edge Function.

## Interpretación

- **Latencia sube y errores en 0** → el sistema aguanta, solo va más lento. Aceptable.
- **Errores 5xx o timeouts** → cuello de botella real. Pasos a considerar:
  - Subir el plan de Supabase (más CPU/conexiones).
  - Activar el connection pooler (Supavisor) para las Edge Functions.
  - Reducir trabajo por solicitud en el webhook (ya se movió el correo a segundo plano).
- **CPU de DB al 100% con pocos VUs** → revisar índices y consultas (ver migración
  `20260622000000_add_performance_indexes.sql`).

## Próximos escenarios sugeridos

- Lectura concurrente: simular N agentes cargando dashboard/listado a la vez (requiere
  tokens de sesión; usar `k6` con login contra Supabase Auth de staging).
- Picos cortos (spike test) además de la carga sostenida (load test) de este script.
