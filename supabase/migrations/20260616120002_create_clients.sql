-- clients: every lead/customer that reaches out via any channel
create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  channel text not null check (channel in ('whatsapp', 'instagram', 'messenger', 'web_chat', 'other')),
  channel_user_id text not null,
  interest_type text check (interest_type in ('real_estate', 'construction', 'concierge', 'other')),
  property_of_interest text,
  budget_range text,
  source text,
  stage_id uuid references pipeline_stages(id),
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contact_at timestamptz,
  unique (channel, channel_user_id)
);

alter table clients enable row level security;

create policy "Authenticated users can select clients"
  on clients for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert clients"
  on clients for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update clients"
  on clients for update
  using (auth.uid() is not null);

-- Automatically update updated_at on every row change
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_clients_updated_at
  before update on clients
  for each row execute procedure update_updated_at_column();
