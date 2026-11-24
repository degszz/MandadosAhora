-- ============================================================================
-- 008 — Bucket de comprobantes + RLS policies para settings
-- ============================================================================

-- 1. Crear bucket publico para comprobantes de transferencia
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

-- 2. RLS: permitir a cualquier usuario autenticado subir comprobantes
create policy "comprobantes_upload_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'comprobantes');

-- 3. RLS: permitir lectura publica de comprobantes (son publicos)
create policy "comprobantes_read_public"
  on storage.objects for select
  to public
  using (bucket_id = 'comprobantes');

-- 4. RLS: permitir al dueño borrar su comprobante
create policy "comprobantes_delete_owner"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'comprobantes' and owner = auth.uid());

-- 5. Arreglar RLS de settings (daba 403 en lecturas)
-- Permitir lectura publica de settings (horarios, hiring, precios)
alter table mandados.settings enable row level security;

-- Drop policies existentes si las hay (idempotente)
drop policy if exists "settings_read_public" on mandados.settings;
drop policy if exists "settings_write_authenticated" on mandados.settings;

-- Lectura: cualquiera puede leer settings (horarios, hiring, precios)
create policy "settings_read_public"
  on mandados.settings for select
  to public
  using (true);

-- Escritura: solo autenticados (admin/repartidor)
create policy "settings_write_authenticated"
  on mandados.settings for all
  to authenticated
  using (true)
  with check (true);
