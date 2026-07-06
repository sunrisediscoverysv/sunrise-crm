// Un contacto "necesita nombre" cuando su full_name sigue siendo el placeholder
// que dejaron los webhooks: vacío, el teléfono o el channel_user_id. Es el mismo
// criterio con el que la migración 20260704120000_add_client_registered.sql marcó
// registered = false, pero evaluado en vivo sobre el nombre real: en cuanto un
// agente (o el perfil del canal) le pone un nombre de verdad, deja de "necesitar".
export function needsName(c: {
  full_name?: string | null
  phone?: string | null
  channel_user_id?: string | null
}): boolean {
  const name = c.full_name?.trim()
  if (!name) return true
  return name === c.phone || name === c.channel_user_id
}
