# Webflow → Sunrise CRM — Guía de integración

Sincroniza automáticamente la colección CMS de propiedades de Webflow con la tabla
`properties` del CRM. Cuando alguien crea, edita, publica o elimina una propiedad
en Webflow, el cambio se refleja en el CRM en segundos.

## Endpoint del webhook

```
POST https://<project-ref>.supabase.co/functions/v1/webflow-webhook?secret=<WEBFLOW_WEBHOOK_SECRET>
```

Reemplaza `<project-ref>` con el ID de tu proyecto en Supabase (Project Settings → API).

## Autenticación

Webflow **no permite añadir headers personalizados** a los webhooks creados desde
el dashboard, así que el secreto viaja como **query param** en la URL: `?secret=...`
(la función también acepta el header `x-webhook-secret` por si creas el webhook vía API).

Configura el secreto en Supabase:

```bash
supabase secrets set WEBFLOW_WEBHOOK_SECRET=<genera-un-valor-aleatorio-seguro>
```

Usa el mismo valor en el `?secret=` de la URL del webhook.

## Eventos que conviene suscribir en Webflow

| Trigger de Webflow | Acción en el CRM |
|--------------------|------------------|
| `collection_item_created`   | Inserta la propiedad |
| `collection_item_changed`   | Actualiza la propiedad (upsert por `slug`) |
| `collection_item_deleted`   | Marca la propiedad como `off_market` (no se borra, para no perder leads vinculados) |
| `collection_item_unpublished` | Marca la propiedad como `off_market` |

> Un ítem archivado o en borrador (`isArchived` / `isDraft`) se guarda como `off_market`.

## Cómo crear el webhook en Webflow

### Opción A — Dashboard (más simple)
1. **Site settings → Apps & integrations → Webhooks**.
2. **Add Webhook**.
3. **Trigger type**: `Collection item created` (repite para `changed`, `deleted`, `unpublished`).
4. **URL**: el endpoint de arriba, **incluyendo `?secret=...`**.
5. Guardar. Repetir para cada trigger.

### Opción B — API de Webflow
`POST https://api.webflow.com/v2/sites/{site_id}/webhooks` con tu token, indicando
`triggerType` y `url`.

## Mapeo de campos (IMPORTANTE)

Webflow envía los campos de la colección bajo `payload.fieldData`, usando los
**slugs** de cada campo. La función intenta reconocer cada columna del CRM probando
varios nombres candidatos (ver `FIELD_MAP` en
[`supabase/functions/webflow-webhook/index.ts`](../supabase/functions/webflow-webhook/index.ts)):

| Columna CRM | Campo(s) en Webflow (slug) |
|-------------|-----------------------------|
| `name`         | `name` |
| `location`     | `loaction` → `location-main` |
| `price_label`  | `price` → `price-per-vara` |
| `size_label`   | `land-area` → `land-area-2` → `m2-total` → `size-sq-ft` |
| `image_url`    | `property-img-1` → `property-img-2` → `property-img-3` |
| `description`  | `summary` |
| `property_type`| `property-type` → `types-select` |
| `status`       | _(la colección no tiene este campo → default `available`)_ |

> Campos de Webflow que **hoy no se guardan** porque la tabla `properties` no tiene
> columna: `rooms`, `bathrooms`, `bedrooms`, `parking-spaces`, `m2-total`,
> `price-per-vara`, `video-for-home`, `map`, `type-of-sale`, etc. Si quieres
> conservarlos, hay que añadir columnas a la tabla (ver migración).

- `slug` se toma siempre del `slug` del ítem (es la clave única del upsert).
- `price_usd` se calcula a partir de `price_label` (si es por unidad, ej. `$100/v²`, queda `null`).
- `source_url` se arma como `https://sunrisediscovery.com/properties/<slug>`.

> **Acción requerida:** confirma los slugs reales de tu colección en Webflow
> (Collection settings → cada campo → "API slug"). Si no coinciden con la tabla,
> añádelos a la lista correspondiente en `FIELD_MAP`.

## Comportamiento del webhook

- Crear/editar/publicar → `upsert` por `slug` (inserta si es nueva, actualiza si ya existe).
- Eliminar/despublicar/archivar/borrador → `status = off_market` (la fila se conserva).
- Nunca se borra una propiedad, para preservar los leads vinculados (`clients.property_id`).

## Respuestas

```json
{ "ok": true, "slug": "land-in-el-zonte", "action": "upsert" }      // 200
{ "ok": true, "slug": "land-in-el-zonte", "action": "off_market" }  // 200
{ "error": "Unauthorized" }            // 401 — secreto inválido o ausente
{ "error": "Missing slug in payload" } // 400
```

## Prueba manual

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/webflow-webhook?secret=tu-secreto-aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "triggerType": "collection_item_created",
    "payload": {
      "slug": "demo-test-land",
      "isDraft": false,
      "isArchived": false,
      "fieldData": {
        "name": "Demo Test Land",
        "location": "El Zonte, La Libertad, El Salvador",
        "price-label": "$120,000",
        "size-label": "1,000 v²",
        "property-type": "land",
        "status": "available"
      }
    }
  }'
```

## Comandos de despliegue

```bash
# Desplegar la función
supabase functions deploy webflow-webhook

# Configurar el secreto
supabase secrets set WEBFLOW_WEBHOOK_SECRET=<genera-un-valor-seguro-aqui>

# Probar localmente
supabase start
supabase functions serve webflow-webhook --env-file .env.local
```
