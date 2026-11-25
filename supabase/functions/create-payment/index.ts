// Edge Function: create-payment
// Crea el link de pago de MercadoPago de un pedido.
// Desplegar con: supabase functions deploy create-payment --no-verify-jwt
// Secrets: MP_ACCESS_TOKEN, SITE_URL (opcional)
//
// El monto NO se toma del navegador: se lee total_amount del pedido con la
// clave de servicio (la base exige un mínimo al crearlo, migración 019).
// Las URLs de vuelta se arman acá con SITE_URL (no se aceptan del cliente).
// external_reference = ID del pedido; payment-webhook lo usa para confirmar.

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "mandados" }, auth: { persistSession: false } },
);
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const SITE_URL = Deno.env.get("SITE_URL") || "https://mandadosahora.netlify.app";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { orderId?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const orderId = String(body.orderId || "");
  if (!UUID_RE.test(orderId)) return json({ error: "orderId inválido" }, 400);
  if (!MP_TOKEN) return json({ error: "MercadoPago no configurado" }, 503);

  try {
    const { data: order, error: dbErr } = await sb.from("orders")
      .select("id, total_amount, payment_status, services_count")
      .eq("id", orderId)
      .maybeSingle();
    if (dbErr) throw dbErr;
    if (!order) return json({ error: "Pedido no encontrado" }, 404);
    if (order.payment_status !== "pendiente") return json({ error: "El pedido ya no está pendiente de pago" }, 409);
    const amount = Number(order.total_amount);
    if (!amount || amount <= 0) return json({ error: "El pedido no tiene monto" }, 400);

    const title = String(body.description || "Mandados Ahora — Servicio de mandados").slice(0, 120);

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: orderId, title, quantity: 1, unit_price: amount, currency_id: "ARS" }],
        back_urls: {
          success: `${SITE_URL}/pago-exitoso?provider=mercadopago&order_id=${orderId}`,
          failure: `${SITE_URL}/pedido?id=${orderId}`,
          pending: `${SITE_URL}/pedido?id=${orderId}`,
        },
        auto_return: "approved",
        external_reference: orderId,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=mercadopago`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[create-payment] MP error:", data);
      return json({ error: data.message || "Error de MercadoPago" }, 502);
    }

    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data.init_point)}`;
    return json({ provider: "mercadopago", paymentUrl: data.init_point, preferenceId: data.id, qrImage, orderId });
  } catch (err) {
    console.error("[create-payment]", err);
    return json({ error: "Error interno" }, 500);
  }
});
