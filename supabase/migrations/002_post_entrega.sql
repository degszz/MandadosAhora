-- ============================================================================
-- Migración: Nuevo modelo de precios — post-entrega + datos bancarios
-- ============================================================================

-- 1. Nuevos campos en orders: datos de compra post-entrega
alter table mandados.orders
  add column if not exists purchase_amount   numeric(10,2),
  add column if not exists ticket_url        text,
  add column if not exists platform_fee      numeric(10,2),
  add column if not exists platform_fee_paid boolean not null default false;

-- 2. Datos bancarios del repartidor
alter table mandados.profiles
  add column if not exists alias_cbu text,
  add column if not exists banco     text;

-- 3. Disponibilidad del repartidor
alter table mandados.profiles
  add column if not exists is_available boolean not null default true;
