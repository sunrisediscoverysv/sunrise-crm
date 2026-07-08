-- Operaciones: ventas cerradas (deals), tareas/pendientes (tasks) y pagos/cuotas (payments).

-- ── Ventas cerradas ──────────────────────────────────────────────────────────
create table deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references clients(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  agent_id uuid references profiles(id) on delete set null,
  amount_usd numeric not null default 0,
  commission_usd numeric,
  status text not null default 'closed' check (status in ('closed', 'pending', 'cancelled')),
  closed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Tareas / pendientes ──────────────────────────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Pagos / cuotas ───────────────────────────────────────────────────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  amount_usd numeric not null default 0,
  due_date date,
  paid_at date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para consultas comunes
create index deals_agent_idx on deals (agent_id);
create index deals_closed_at_idx on deals (closed_at desc);
create index tasks_assigned_idx on tasks (assigned_to);
create index tasks_status_idx on tasks (status);
create index payments_deal_idx on payments (deal_id);
create index payments_due_idx on payments (due_date);

-- updated_at automático (reutiliza la función existente de properties)
create trigger set_deals_updated_at    before update on deals    for each row execute procedure update_updated_at_column();
create trigger set_tasks_updated_at    before update on tasks    for each row execute procedure update_updated_at_column();
create trigger set_payments_updated_at before update on payments for each row execute procedure update_updated_at_column();

-- RLS: mismo modelo que el resto del CRM (acceso a usuarios autenticados)
alter table deals    enable row level security;
alter table tasks    enable row level security;
alter table payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['deals', 'tasks', 'payments'] loop
    execute format('create policy "auth can select %1$s" on %1$s for select using (auth.uid() is not null)', t);
    execute format('create policy "auth can insert %1$s" on %1$s for insert with check (auth.uid() is not null)', t);
    execute format('create policy "auth can update %1$s" on %1$s for update using (auth.uid() is not null)', t);
    execute format('create policy "auth can delete %1$s" on %1$s for delete using (auth.uid() is not null)', t);
  end loop;
end $$;
