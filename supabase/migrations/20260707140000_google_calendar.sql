-- Integración con Google Calendar: tokens OAuth por usuario + id del evento
-- sincronizado en cada cita.

create table google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_expiry timestamptz,
  google_email text,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table google_calendar_tokens enable row level security;

-- Cada usuario solo ve/gestiona su propia conexión. La escritura de tokens
-- la hace la edge function con service-role (bypassa RLS); estas políticas
-- permiten a la UI mostrar el estado y desconectar.
create policy "own google token select"
  on google_calendar_tokens for select
  using (auth.uid() = user_id);

create policy "own google token delete"
  on google_calendar_tokens for delete
  using (auth.uid() = user_id);

create trigger set_google_tokens_updated_at
  before update on google_calendar_tokens
  for each row execute procedure update_updated_at_column();

-- Enlaza cada cita con su evento en Google (para actualizar/eliminar).
alter table appointments
  add column if not exists google_event_id text;
