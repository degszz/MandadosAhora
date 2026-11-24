/** Mensaje de pedido por WhatsApp, compartido por checkout y pedido rápido. */

export const WA_NUMBER = "5492271415182";

const METODOS = {
  stripe: "Tarjeta (Stripe)",
  mercadopago: "MercadoPago",
  efectivo: "Efectivo al recibir",
};

const formatARS = (n) => "$" + Number(n).toLocaleString("es-AR");

export function buildOrderMessage({ orderId, nombre, telefono, servicios, direccion, total, metodo, paymentUrl, deliveryCode }) {
  const dirTxt = direccion?.address || direccion?.texto || "";
  const mapsUrl =
    direccion?.lat != null && direccion?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${direccion.lat},${direccion.lng}`
      : "";

  const lines = ["*NUEVO PEDIDO*", ""];
  if (nombre) lines.push(`Nombre: ${nombre}`);
  if (telefono) lines.push(`Tel: ${telefono}`);
  if (dirTxt) lines.push(`Direccion: ${dirTxt}`);
  if (mapsUrl) lines.push(`Maps: ${mapsUrl}`);
  lines.push("");

  lines.push(`— Detalle (${servicios.length}) —`);
  servicios.forEach((s, i) => {
    lines.push("");
    lines.push(`*${i + 1}. ${s.servicio}*`);
    if (s.negocio) lines.push(`Local: ${s.negocio}`);
    if (s.descripcion) lines.push(s.descripcion);
  });
  lines.push("");

  lines.push(`*Total: ${formatARS(total)}* (${servicios.length} servicio${servicios.length > 1 ? "s" : ""})`);
  lines.push(`Pago: ${METODOS[metodo] || metodo} — Fee del servicio`);
  lines.push("");
  lines.push("*Importante:* El repartidor te va a enviar el ticket de compra");
  lines.push("y un link para pagar el 15% de comisión cuando complete el pedido.");
  if (paymentUrl) lines.push(`Link: ${paymentUrl}`);
  if (deliveryCode) lines.push("", `*Codigo de entrega: ${deliveryCode}* — Darselo al repartidor al recibir.`);
  lines.push(`Pedido: ${orderId}`);

  return lines.join("\n");
}

export function whatsappOrderUrl(args) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(buildOrderMessage(args))}`;
}
