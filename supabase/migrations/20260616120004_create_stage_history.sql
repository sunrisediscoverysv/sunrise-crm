-- stage_history: audit trail of pipeline stage changes
create table stage_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  from_stage_id uuid references pipeline_stages(id),
  to_stage_id uuid not null references pipeline_stages(id),
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table stage_history enable row level security;

create policy "Authenticated users can select stage_history"
  on stage_history for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert stage_history"
  on stage_history for insert
  with check (auth.uid() is not null);
