-- ============================================================================
-- 005 — customer_phone en orders (para WhatsApp notifications)
-- ============================================================================

alter table mandados.orders
  add column if not exists customer_phone text;
