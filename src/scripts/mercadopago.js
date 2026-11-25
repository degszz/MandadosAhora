/**
 * Pagos — Mandados Ahora (solo MercadoPago).
 *
 * El token de MP vive como secret en Supabase, nunca en el frontend.
 * Edge Functions:
 *   - create-payment: link de pago del pedido. El monto y las URLs de vuelta
 *     los arma el servidor a partir del pedido; acá solo se manda el ID.
 *   - payment-webhook: recibe confirmaciones de MP y actualiza el pedido.
 */

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "https://aiagaddxujtbyudriulh.supabase.co";
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/create-payment`;

/**
 * Crea el link de pago de MercadoPago de un pedido ya guardado.
 * `amount` se acepta por compatibilidad pero se ignora: cobra total_amount del pedido.
 *
 * @param {Object} opts
 * @param {String} opts.orderId      ID del pedido (UUID de Supabase)
 * @param {String} [opts.description] Descripción visible al pagar
 * @returns {Promise<{ provider, paymentUrl, preferenceId, qrImage, orderId }>}
 */
export async function createMPPreference({ orderId, description }) {
  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      description: description || "Mandados Ahora — Servicio de mandados",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error creando el pago de MercadoPago (${res.status})`);
  }

  return await res.json();
}

/** Compat: nombre viejo. */
export async function createPaymentPreference(opts) {
  return await createMPPreference(opts);
}

export const MP_CONFIG = {
  enabled: true,
  isProductionMode: true,
};
