-- client_attachments: archivos adjuntos por cliente (contratos, fotos, documentos)
create table client_attachments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  file_name text not null,
  file_path text not null,      -- ruta dentro del bucket de storage
  file_size bigint,
  mime_type text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index client_attachments_client_id_idx on client_attachments (client_id);

alter table client_attachments enable row level security;

create policy "Authenticated users can select attachments"
  on client_attachments for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert attachments"
  on client_attachments for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can delete attachments"
  on client_attachments for delete
  using (auth.uid() is not null);

-- Bucket de storage privado para los adjuntos
insert into storage.buckets (id, name, public)
values ('client-attachments', 'client-attachments', false)
on conflict (id) do nothing;

-- Políticas de storage: solo usuarios autenticados operan sobre este bucket
create policy "Authenticated can read client attachments"
  on storage.objects for select
  using (bucket_id = 'client-attachments' and auth.uid() is not null);

create policy "Authenticated can upload client attachments"
  on storage.objects for insert
  with check (bucket_id = 'client-attachments' and auth.uid() is not null);

create policy "Authenticated can delete client attachments"
  on storage.objects for delete
  using (bucket_id = 'client-attachments' and auth.uid() is not null);
