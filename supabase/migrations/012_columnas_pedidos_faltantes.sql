-- ============================================================================
-- 012 — Columnas de 005, 006 y 007 que nunca llegaron a la base real
-- Sin customer_phone, createOrder() fallaba y no se guardaba ningún pedido.
-- Solo agrega. NO aplicar 003 (borra schedules) ni la parte de settings de 008
-- (abre la escritura a cualquier usuario autenticado).
-- ============================================================================

alter table mandados.orders
  add column if not exists customer_phone text,
  add column if not exists payment_proof_url text,
  add column if not exists updated_by uuid references mandados.profiles(id);

insert into mandados.settings (key, value) values
  ('service_fee_online',  '2500'::jsonb),
  ('service_fee_offline', '3500'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
