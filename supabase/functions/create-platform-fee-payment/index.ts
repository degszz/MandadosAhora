// Edge Function: create-platform-fee-payment
// Crea un link de pago de MercadoPago SOLO para el 15% de plataforma.
// Se llama DESPUÉS de la entrega, cuando el repartidor sube el ticket.
// Desplegar con: supabase functions deploy create-platform-fee-payment --no-verify-jwt
// Secrets: MP_ACCESS_TOKEN, SITE_URL (opcional)
//
// El item de la preferencia termina en "-fee": así payment-webhook distingue
// esta comisión del pago del pedido.
// El monto NO se toma del navegador: se lee `platform_fee` del pedido con la
// clave de servicio (lo guarda el repartidor al subir el ticket).

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "mandados" }, auth: { persistSession: false } },
);
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const SITE_URL = Deno.env.get("SITE_URL") || "https://mandadosahora.netlify.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { orderId } = body;
  if (!orderId) return json({ error: "orderId es requerido" }, 400);
  if (!MP_TOKEN) return json({ error: "MP_ACCESS_TOKEN no configurado" }, 500);

  try {
    const { data: order, error: dbErr } = await sb.from("orders")
      .select("id, platform_fee, platform_fee_paid")
      .eq("id", orderId)
      .maybeSingle();
    if (dbErr) throw dbErr;
    if (!order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.platform_fee_paid) return json({ error: "La comisión ya está paga" }, 409);
    const amount = Number(order.platform_fee);
    if (!amount || amount <= 0) return json({ error: "El pedido no tiene comisión calculada" }, 400);

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          id: `${orderId}-fee`,
          title: `Comisión plataforma 15% — Pedido ${String(orderId).slice(0, 8)}`,
          quantity: 1,
          unit_price: amount,
          currency_id: "ARS",
        }],
        back_urls: {
          success: `${SITE_URL}/pago-exitoso?provider=mercadopago&order_id=${orderId}&type=platform_fee`,
          failure: `${SITE_URL}/pedido?id=${orderId}`,
          pending: `${SITE_URL}/pedido?id=${orderId}`,
        },
        auto_return: "approved",
        external_reference: orderId,
        notification_url:
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=mercadopago`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[create-platform-fee-payment] MP error:", data);
      return json({ error: data.message || "Error de MercadoPago" }, 502);
    }
    return json({
      provider: "mercadopago",
      paymentUrl: data.init_point,
      preferenceId: data.id,
      orderId,
    });
  } catch (err) {
    console.error("[create-platform-fee-payment]", err);
    return json({ error: "Error interno" }, 500);
  }
});
