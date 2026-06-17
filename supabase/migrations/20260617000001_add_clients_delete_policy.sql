-- Allow authenticated users to delete clients
-- Applied directly via Management API on 2026-06-17
create policy "Authenticated users can delete clients"
  on clients for delete
  using (auth.uid() is not null);
