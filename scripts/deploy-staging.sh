#!/usr/bin/env bash
# Despliega migraciones + Edge Functions a un proyecto Supabase de STAGING.
#
# Uso:
#   STAGING_REF=<ref-de-staging> ./scripts/deploy-staging.sh
#
# ⚠️ Este script hace `supabase link` al proyecto de STAGING. Al terminar
#    vuelve a enlazar producción para que no quedes apuntando a staging por error.

set -euo pipefail

: "${STAGING_REF:?Define STAGING_REF con el ref del proyecto de staging}"
PROD_REF="hossxvizztnvldoibnrh"

echo "→ Enlazando staging ($STAGING_REF)…"
npx supabase link --project-ref "$STAGING_REF"

echo "→ Aplicando migraciones a staging…"
npx supabase db push

echo "→ Desplegando Edge Function botpress-webhook a staging…"
npx supabase functions deploy botpress-webhook --project-ref "$STAGING_REF"

echo "→ Re-enlazando producción ($PROD_REF) para evitar accidentes…"
npx supabase link --project-ref "$PROD_REF"

echo ""
echo "✅ Staging listo. Falta (una sola vez) configurar el secreto del webhook:"
echo "   npx supabase secrets set BOTPRESS_WEBHOOK_SECRET=<secret> --project-ref $STAGING_REF"
echo ""
echo "Luego corre la prueba de carga (ver loadtest/README.md):"
echo "   k6 run -e WEBHOOK_URL=\"https://$STAGING_REF.supabase.co/functions/v1/botpress-webhook\" \\"
echo "          -e WEBHOOK_SECRET=\"<secret>\" loadtest/webhook-load.js"
