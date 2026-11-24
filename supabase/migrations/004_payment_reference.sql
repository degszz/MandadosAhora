-- ============================================================================
-- 004 — payment_reference en orders
-- ============================================================================

-- Necesario para guardar el sessionId de Stripe o preferenceId de MercadoPago
alter table mandados.orders
  add column if not exists payment_reference text;
