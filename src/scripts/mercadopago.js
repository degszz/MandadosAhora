/**
 * Servicio MercadoPago — Mandados Ahora
 *
 * Capa de integración con MercadoPago. Stub local que simula la
 * generación de una preferencia de pago.
 *
 * En producción, esto debe llamar a un endpoint backend que use
 * el SDK oficial con el ACCESS_TOKEN del vendedor (no se puede
 * desde el navegador por motivos de seguridad).
 *
 *   Backend (Node, ejemplo):
 *     POST /api/mercadopago/preference  { orderId, amount, description }
 *     -> { id, init_point, qr_code_base64 }
 *
 * Para activar el modo real:
 *   1. Setear MP_BACKEND_URL al endpoint del backend
 *   2. El backend usa el SDK de MercadoPago para crear la preferencia
 *   3. Configurar webhook que actualice el estado del pago llamando
 *      a markPaid(orderId) en orders.js
 */

const MP_BACKEND_URL = ""; // Vacío = modo demo. Ej: "https://api.miapp.com/mercadopago/preference"

/**
 * Crea una preferencia de pago para un pedido.
 * @param {Object} opts
 * @param {String} opts.orderId      ID del pedido en nuestro sistema
 * @param {Number} opts.amount       Monto en ARS
 * @param {String} opts.description  Descripción visible al pagar
 * @returns {Promise<{ id, paymentUrl, qrImage, demo }>}
 */
export async function createPaymentPreference({ orderId, amount, description }) {
  if (MP_BACKEND_URL) {
    // Modo producción: delegar al backend
    const res = await fetch(MP_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, amount, description }),
    });
    if (!res.ok) throw new Error(`MercadoPago backend error: ${res.status}`);
    const data = await res.json();
    return {
      id: data.id,
      paymentUrl: data.init_point,
      qrImage: data.qr_code_base64
        ? `data:image/png;base64,${data.qr_code_base64}`
        : null,
      demo: false,
    };
  }

  // Modo demo: generamos un link ficticio y un QR usando un servicio público
  // que renderiza códigos QR a partir de texto. El admin puede confirmar el
  // pago manualmente desde el panel.
  const fakePref = `MP-${orderId.slice(-8).toUpperCase()}`;
  const fakeUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${fakePref}&amount=${amount}&order=${encodeURIComponent(orderId)}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fakeUrl)}`;

  return {
    id: fakePref,
    paymentUrl: fakeUrl,
    qrImage: qr,
    demo: true,
  };
}

/**
 * Consultar estado de pago. En modo demo devuelve siempre "pendiente".
 * En producción, hacer fetch al backend que consulta la API de MP.
 * @param {String} preferenceId
 * @returns {Promise<{ estado: "pendiente" | "pagado" | "rechazado" }>}
 */
export async function getPaymentStatus(preferenceId) {
  if (MP_BACKEND_URL) {
    const res = await fetch(`${MP_BACKEND_URL}/${encodeURIComponent(preferenceId)}/status`);
    if (!res.ok) throw new Error(`MercadoPago backend error: ${res.status}`);
    return await res.json();
  }
  return { estado: "pendiente" };
}

export const MP_CONFIG = {
  enabled: true,
  isProductionMode: Boolean(MP_BACKEND_URL),
};
