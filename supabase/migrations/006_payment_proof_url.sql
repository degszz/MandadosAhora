-- ============================================================================
-- 006 — payment_proof_url en orders (comprobante de transferencia)
-- ============================================================================

alter table mandados.orders
  add column if not exists payment_proof_url text;
