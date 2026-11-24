-- ============================================================================
-- 007 — Pagos profesionalizados
-- ============================================================================

-- paid_to_repartidor: admin marca cuando le pagó al repartidor
alter table mandados.orders
  add column if not exists paid_to_repartidor boolean not null default false;

-- platform_fee_paid: el webhook marca esto cuando se paga el 15% de comision
alter table mandados.orders
  add column if not exists platform_fee_paid boolean not null default false;

-- updated_by: quién cambió el estado por última vez (auditoría)
alter table mandados.orders
  add column if not exists updated_by uuid references mandados.profiles(id);

-- Precios configurables (admin los setea desde el panel)
-- Se guardan en settings igual que hiring_active y business_open
insert into mandados.settings (key, value) values
  ('service_fee_online',  '2500'::jsonb),
  ('service_fee_offline', '3500'::jsonb)
on conflict (key) do nothing;