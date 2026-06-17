-- messages: raw conversation log from Botpress
create table messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  content text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "Authenticated users can select messages"
  on messages for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert messages"
  on messages for insert
  with check (auth.uid() is not null);
