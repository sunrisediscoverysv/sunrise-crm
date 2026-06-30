-- appointments: citas agendadas con clientes para dar seguimiento
create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text,
  appointment_type text not null default 'visit'
    check (appointment_type in ('visit', 'call', 'meeting', 'signing', 'follow_up', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table appointments enable row level security;

create policy "Authenticated users can select appointments"
  on appointments for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert appointments"
  on appointments for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update appointments"
  on appointments for update
  using (auth.uid() is not null);

create policy "Authenticated users can delete appointments"
  on appointments for delete
  using (auth.uid() is not null);

-- Consultas del calendario filtran por rango de fechas y por cliente
create index appointments_starts_at_idx on appointments (starts_at);
create index appointments_client_id_idx on appointments (client_id);
create index appointments_assigned_to_idx on appointments (assigned_to);

-- Mantener updated_at al día (reusa la función creada en la migración de clients)
create trigger set_appointments_updated_at
  before update on appointments
  for each row execute procedure update_updated_at_column();
