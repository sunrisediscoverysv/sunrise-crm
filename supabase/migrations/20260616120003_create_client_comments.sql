-- client_comments: internal team notes about a client's status
create table client_comments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  author_id uuid not null references profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

alter table client_comments enable row level security;

create policy "Authenticated users can select client_comments"
  on client_comments for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert client_comments"
  on client_comments for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update client_comments"
  on client_comments for update
  using (auth.uid() is not null);
