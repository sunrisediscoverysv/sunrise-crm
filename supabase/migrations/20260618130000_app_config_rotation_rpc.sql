-- Formaliza app_config (se había creado a mano, fuera de migraciones), agrega una
-- función segura para la rotación de agentes y activa RLS para que NADIE pueda
-- leer/escribir la tabla directamente con la llave pública. Botpress accede solo
-- a través de la función next_agent_rotation_index() (SECURITY DEFINER).

create table if not exists public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value)
  values ('agent_rotation_index', '0')
  on conflict (key) do nothing;

-- Devuelve el índice actual y lo incrementa de forma atómica (elimina la condición
-- de carrera del patrón leer-luego-escribir). SECURITY DEFINER: corre con los
-- privilegios del dueño, así sigue funcionando aunque RLS bloquee el acceso directo.
create or replace function public.next_agent_rotation_index()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_index integer;
begin
  update public.app_config
     set value = ((value::int) + 1)::text,
         updated_at = now()
   where key = 'agent_rotation_index'
  returning ((value::int) - 1) into current_index;

  return coalesce(current_index, 0);
end;
$$;

grant execute on function public.next_agent_rotation_index() to anon, authenticated;

-- Activa RLS sin políticas: bloquea todo acceso directo con la llave pública.
-- service_role (Edge Functions) y la función SECURITY DEFINER siguen funcionando.
alter table public.app_config enable row level security;
