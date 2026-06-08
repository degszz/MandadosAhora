/**
 * Servicio de Pagos — Mandados Ahora
 *
 * Integración real con Stripe y MercadoPago vía Supabase Edge Functions.
 * Las API keys viven como secrets en Supabase, nunca en el frontend.
 *
 * Edge Functions:
 *   - create-payment: crea sesión de Stripe Checkout o preferencia de MP
 *   - payment-webhook: recibe confirmaciones y actualiza la orden
 */

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "https://aiagaddxujtbyudriulh.supabase.co";
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/create-payment`;

// URL base del sitio (se ajusta automáticamente entre dev y prod)
function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:4321";
}

/**
 * Crea una sesión de pago con Stripe (tarjeta de crédito/débito).
 * Redirige al usuario al checkout de Stripe.
 *
 * @param {Object} opts
 * @param {String} opts.orderId      ID del pedido (UUID de Supabase)
 * @param {Number} opts.amount       Monto en ARS (ej: 3000)
 * @param {String} opts.description  Descripción visible al pagar
 * @returns {Promise<{ provider, paymentUrl, sessionId, orderId }>}
 */
export async function createStripeSession({ orderId, amount, description }) {
  const base = getSiteUrl();
  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "stripe",
      orderId,
      amount,
      description: description || "Mandados Ahora — Servicio de delivery",
      successUrl: `${base}/pago-exitoso?provider=stripe&order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/checkout`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error creando sesión de Stripe (${res.status})`);
  }

  return await res.json();
}

/**
 * Crea una preferencia de pago con MercadoPago.
 * El usuario puede pagar con QR, link o transferencia.
 *
 * @param {Object} opts
 * @param {String} opts.orderId      ID del pedido (UUID de Supabase)
 * @param {Number} opts.amount       Monto en ARS (ej: 3000)
 * @param {String} opts.description  Descripción visible al pagar
 * @returns {Promise<{ provider, paymentUrl, preferenceId, qrImage, orderId }>}
 */
export async function createMPPreference({ orderId, amount, description }) {
  const base = getSiteUrl();
  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "mercadopago",
      orderId,
      amount,
      description: description || "Mandados Ahora — Servicio de delivery",
      successUrl: `${base}/pago-exitoso?provider=mercadopago&order_id=${orderId}`,
      cancelUrl: `${base}/checkout`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error creando preferencia de MercadoPago (${res.status})`);
  }

  return await res.json();
}

/**
 * Compat: la función vieja que usaba checkout.astro.
 * Ahora delega a createMPPreference.
 */
export async function createPaymentPreference({ orderId, amount, description }) {
  return await createMPPreference({ orderId, amount, description });
}

export const MP_CONFIG = {
  enabled: true,
  isProductionMode: true,
};
