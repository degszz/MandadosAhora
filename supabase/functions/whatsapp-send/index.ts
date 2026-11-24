// Edge Function: whatsapp-send
// Envia mensajes de WhatsApp via Meta Cloud API
// Desplegar con: supabase functions deploy whatsapp-send
// Secrets: META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID

const META_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");

interface SendRequest {
  to: string;       // numero del cliente en formato 549XXXXXXXXXX
  orderId?: string;
  status?: string;   // created | confirmed | en_camino | entregado | cancelado
  repartidor?: string;
  trackingUrl?: string;
}

function buildMessage(req: SendRequest): string {
  const track = req.trackingUrl || "";
  const t = track ? `\n\nSeguí tu pedido: ${track}` : "";

  switch (req.status) {
    case "created":
      return `✅ *Pedido confirmado #${req.orderId}*\n\n` +
        `Tu pedido fue recibido y está pendiente de asignación.` +
        `\nTe avisamos cuando un repartidor lo tome.${t}`;

    case "confirmed":
      return `🛵 *Tu pedido #${req.orderId} está confirmado*\n\n` +
        `Un repartidor ya tomó tu pedido${req.repartidor ? ` (${req.repartidor})` : ""}.` +
        `\nPronto saldrá hacia el local.${t}`;

    case "en_camino":
      return `📦 *Tu pedido #${req.orderId} está en camino*\n\n` +
        `El repartidor ya va rumbo a tu domicilio.${t}`;

    case "entregado":
      return `🎉 *Pedido #${req.orderId} entregado*\n\n` +
        `Tu pedido fue entregado. ¡Gracias por confiar en Mandados Ahora!${t}`;

    case "cancelado":
      return `❌ *Pedido #${req.orderId} cancelado*\n\n` +
        `Tu pedido fue cancelado. Si tenés dudas, contactanos.${t}`;

    case "chat_message":
      return `💬 *Nuevo mensaje en tu pedido #${req.orderId}*\n\n` +
        `El repartidor te escribió. Entrá al seguimiento para verlo.${t}`;

    default:
      return `📋 *Pedido #${req.orderId}*\n\n` +
        `Estado actual: ${req.status || "pendiente"}.${t}`;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  if (!META_TOKEN || !PHONE_NUMBER_ID) {
    return new Response(JSON.stringify({ error: "Meta WhatsApp no configurado (secrets faltantes)" }), { status: 500 });
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { to, orderId, status, repartidor, trackingUrl } = body;
  if (!to) {
    return new Response(JSON.stringify({ error: "to (numero) es requerido" }), { status: 400 });
  }

  const text = buildMessage({ to, orderId, status, repartidor, trackingUrl });

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    const result = await resp.json();
    if (!resp.ok) {
      console.error("[whatsapp-send] Meta error:", result);
      return new Response(JSON.stringify({ error: result?.error?.message || "Error enviando WhatsApp" }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, messageId: result.messages?.[0]?.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-send]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
