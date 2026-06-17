-- profiles: internal team users (agents), linked to auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'agente' check (role in ('admin', 'agente', 'visor')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Authenticated users can select profiles"
  on profiles for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert profiles"
  on profiles for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update profiles"
  on profiles for update
  using (auth.uid() is not null);

-- Automatically create a profile row when a new auth user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
