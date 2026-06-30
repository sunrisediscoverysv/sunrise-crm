// supabase-js entrega los errores HTTP de las Edge Functions como FunctionsHttpError,
// con el cuerpo de la respuesta en `error.context` (un Response). Este helper extrae
// el mensaje `{ error }` que devuelven nuestras funciones.
export async function functionsErrorMessage(error: unknown, fallback = 'Ocurrió un error.'): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const parsed = await ctx.clone().json()
      if (parsed?.error) return String(parsed.error)
    } catch {
      /* el cuerpo no era JSON */
    }
  }
  return (error as Error)?.message ?? fallback
}
