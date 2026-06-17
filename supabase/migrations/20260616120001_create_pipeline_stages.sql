-- pipeline_stages: configurable sales funnel stages
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null,
  color text not null default '#888887',
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

alter table pipeline_stages enable row level security;

create policy "Authenticated users can select pipeline_stages"
  on pipeline_stages for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert pipeline_stages"
  on pipeline_stages for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update pipeline_stages"
  on pipeline_stages for update
  using (auth.uid() is not null);

-- Only admins can delete stages (prevent accidental data loss)
create policy "Only admins can delete pipeline_stages"
  on pipeline_stages for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
