-- push_subscriptions: suscripciones Web Push de cada dispositivo/usuario
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Authenticated can select push subs"
  on push_subscriptions for select
  using (auth.uid() is not null);

create policy "Authenticated can insert push subs"
  on push_subscriptions for insert
  with check (auth.uid() is not null);

create policy "Authenticated can update push subs"
  on push_subscriptions for update
  using (auth.uid() is not null);

create policy "Authenticated can delete push subs"
  on push_subscriptions for delete
  using (auth.uid() is not null);
