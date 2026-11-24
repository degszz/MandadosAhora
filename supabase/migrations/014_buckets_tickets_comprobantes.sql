-- 014: buckets de tickets (repartidor) y comprobantes (cliente). Públicos para leer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tickets', 'tickets', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('comprobantes', 'comprobantes', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ticket de compra: lo sube un usuario con sesión (repartidor / admin)
drop policy if exists tickets_upload_auth on storage.objects;
create policy tickets_upload_auth on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets');

-- Comprobante de transferencia: lo sube el cliente sin login
drop policy if exists comprobantes_upload_public on storage.objects;
create policy comprobantes_upload_public on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'comprobantes');
