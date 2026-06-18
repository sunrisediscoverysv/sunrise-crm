-- properties: catálogo de propiedades de Sunrise Discovery (sincronizado desde sunrisediscovery.com)
create table properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  location text,
  property_type text not null default 'land' check (property_type in ('land', 'house', 'department', 'lot', 'other')),
  price_label text,        -- valor tal como se muestra ("$420,000", "$100/v²")
  price_usd numeric,       -- valor absoluto en USD para ordenar/filtrar (null si es por v²)
  size_label text,         -- tamaño tal como se muestra ("18,000 v²")
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'off_market')),
  description text,
  image_url text,
  source_url text,         -- enlace a la página pública de la propiedad
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table properties enable row level security;

create policy "Authenticated users can select properties"
  on properties for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert properties"
  on properties for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update properties"
  on properties for update
  using (auth.uid() is not null);

create policy "Authenticated users can delete properties"
  on properties for delete
  using (auth.uid() is not null);

create trigger set_properties_updated_at
  before update on properties
  for each row execute procedure update_updated_at_column();
