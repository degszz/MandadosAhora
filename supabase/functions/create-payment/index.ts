// Edge Function: create-payment
// Crea sesion de Stripe Checkout o preferencia de MercadoPago
// Desplegar con: supabase functions deploy create-payment

import Stripe from "npm:stripe";
import { MercadoPagoConfig, Preference } from "npm:mercadopago";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: "mandados" },
  auth: { persistSession: false },
});

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let body: {
    provider: string;
    orderId: string;
    amount: number;
    description: string;
    successUrl: string;
    cancelUrl: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { provider, orderId, amount, description, successUrl, cancelUrl } = body;

  if (!provider || !orderId || !amount) {
    return new Response(JSON.stringify({ error: "provider, orderId, amount son requeridos" }), { status: 400 });
  }

  try {
    if (provider === "stripe") {
      if (!STRIPE_KEY) throw new Error("STRIPE_SECRET_KEY no configurado");

      const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-06-16.acacia" } as any);
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: "ars",
            product_data: { name: description || "Mandados Ahora" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { orderId },
      });

      await supabase.from("orders").update({
        payment_reference: session.id,
        payment_status: "pendiente",
      }).eq("id", orderId);

      return new Response(JSON.stringify({
        provider: "stripe",
        paymentUrl: session.url,
        sessionId: session.id,
        orderId,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (provider === "mercadopago") {
      if (!MP_TOKEN) throw new Error("MP_ACCESS_TOKEN no configurado");

      const client = new MercadoPagoConfig({ accessToken: MP_TOKEN });
      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: [{
            id: orderId,
            title: description || "Mandados Ahora",
            quantity: 1,
            unit_price: amount,
            currency_id: "ARS",
          }],
          back_urls: {
            success: successUrl,
            failure: cancelUrl,
            pending: cancelUrl,
          },
          auto_return: "approved",
          external_reference: orderId,
        },
      });

      await supabase.from("orders").update({
        payment_reference: result.id,
        payment_status: "pendiente",
      }).eq("id", orderId);

      return new Response(JSON.stringify({
        provider: "mercadopago",
        paymentUrl: result.sandbox_init_point || result.init_point,
        preferenceId: result.id,
        qrImage: null,
        orderId,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Provider desconocido: ${provider}` }), { status: 400 });
  } catch (err) {
    console.error("[create-payment]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
