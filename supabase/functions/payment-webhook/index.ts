// Edge Function: payment-webhook
// Recibe avisos de MercadoPago y confirma pagos en mandados.orders.
// Desplegar con: supabase functions deploy payment-webhook --no-verify-jwt
// Secrets: MP_ACCESS_TOKEN (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen por defecto)
//
// No se confía en el cuerpo del aviso: se vuelve a consultar el pago a la API
// de MercadoPago con nuestro token y se usa lo que devuelve MercadoPago.
// Usa la clave de servicio porque el rol anónimo ya no puede modificar pedidos.

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "mandados" }, auth: { persistSession: false } },
);
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const STATUS_MAP: Record<string, string> = {
  approved: "pagado",
  pending: "pendiente",
  in_process: "pendiente",
  rejected: "rechazado",
  refunded: "reembolsado",
  cancelled: "cancelado",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const provider = new URL(req.url).searchParams.get("provider");
  if (provider !== "mercadopago") return json({ error: "Provider inválido" }, 400);
  if (!MP_TOKEN) return json({ error: "MP_ACCESS_TOKEN no configurado" }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  // MP envía { type: "payment", data: { id } } (o action payment.created/updated)
  const isPayment = body?.type === "payment" || String(body?.action || "").startsWith("payment.");
  const paymentId = body?.data?.id;
  if (!isPayment || !paymentId) return json({ received: true });

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!res.ok) {
      console.error("[payment-webhook] MP API error:", res.status);
      return json({ error: "MP API error" }, 500);
    }
    const payment = await res.json();

    const orderId = payment.external_reference;
    if (!orderId) {
      console.log("[payment-webhook] pago sin external_reference:", paymentId);
      return json({ received: true });
    }

    // Pago de la comisión de plataforma: el item de la preferencia termina en "-fee"
    const isPlatformFee = (payment.additional_info?.items ?? []).some(
      (it: any) => String(it?.id || "").endsWith("-fee"),
    );

    // El monto de la preferencia lo pudo armar el navegador: se compara lo
    // cobrado de verdad contra lo que dice el pedido antes de marcar nada.
    const { data: order, error: dbErr } = await sb.from("orders")
      .select("id, total_amount, platform_fee")
      .eq("id", orderId)
      .maybeSingle();
    if (dbErr) throw dbErr;
    if (!order) {
      console.log("[payment-webhook] pedido inexistente:", orderId);
      return json({ received: true });
    }
    const paid = Number(payment.transaction_amount) || 0;
    const expected = Number(isPlatformFee ? order.platform_fee : order.total_amount) || 0;
    const amountOk = payment.currency_id === "ARS" && expected > 0 && paid + 0.5 >= expected;
    if (payment.status === "approved" && !amountOk) {
      console.warn(`[payment-webhook] monto no coincide en ${orderId}: pagó ${paid} ${payment.currency_id}, esperado ${expected}`);
      return json({ received: true, ignored: "monto" });
    }

    const now = new Date().toISOString();
    if (isPlatformFee) {
      if (payment.status === "approved") {
        const { error } = await sb.from("orders")
          .update({ platform_fee_paid: true, updated_at: now })
          .eq("id", orderId);
        if (error) throw error;
        console.log("[payment-webhook] comisión pagada:", orderId);
      }
    } else {
      const mapped = STATUS_MAP[payment.status] || "pendiente";
      const patch: Record<string, unknown> = {
        payment_status: mapped,
        payment_provider: "mercadopago",
        payment_reference: String(paymentId),
        updated_at: now,
      };
      if (mapped === "pagado") patch.paid_at = now;
      const { error } = await sb.from("orders").update(patch).eq("id", orderId);
      if (error) throw error;
      console.log(`[payment-webhook] pedido ${orderId}: ${mapped}`);
    }

    return json({ received: true });
  } catch (err) {
    console.error("[payment-webhook]", err);
    return json({ error: "Error interno" }, 500);
  }
});
