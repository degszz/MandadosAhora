/**
 * Servicio de pedidos — Mandados Ahora
 *
 * Backed por Supabase (schema `mandados.orders`).
 * Reemplaza la versión anterior que usaba localStorage.
 */
import { getSupabase } from "./supabase.js";

const ESTADOS = ["pendiente", "confirmado", "en_camino", "entregado", "cancelado"];
const ESTADOS_PAGO = ["pendiente", "pagado", "rechazado"];

/**
 * Crear un nuevo pedido en Supabase.
 *
 * @param {Object} data
 * @param {Array}  data.servicios     Items del carrito
 * @param {String} data.nombre        Nombre del cliente
 * @param {Object} data.ubicacion     { tipo, direccion, numero?, lat?, lng? }
 * @param {Object} data.pago          { metodo, monto }
 * @param {String} [data.deliveryCode] Código de entrega
 * @param {Number} [data.driverCommission] Comisión del repartidor
 * @returns {Promise<Object>} pedido creado (fila de Supabase)
 */
export async function createOrder(data) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");

  const items = (data.servicios || []).map((s) => ({
    servicio: s.servicio || "",
    negocio: s.negocio || "",
    descripcion: s.descripcion || "",
    cantidad: s.cantidad ?? 1,
    imagen: s.imagen || null,
  }));

  const payload = {
    customer_name: data.nombre || null,
    items,
    address: data.ubicacion?.direccion || "",
    address_type: data.ubicacion?.tipo || "manual",
    address_number: data.ubicacion?.numero || "",
    address_lat: data.ubicacion?.lat ?? null,
    address_lng: data.ubicacion?.lng ?? null,
    payment_method: data.pago?.metodo || "efectivo",
    payment_status: "pendiente",
    status: "pendiente",
    total_amount: data.pago?.monto ?? 0,
    driver_commission: data.driverCommission ?? null,
    services_count: items.length,
    delivery_code: data.deliveryCode || null,
  };

  const { data: order, error } = await sb
    .from("orders")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  try {
    const stored = JSON.parse(localStorage.getItem("mandados_my_orders") || "[]");
    stored.push({ id: order.id, name: data.nombre || "", created: new Date().toISOString() });
    if (stored.length > 20) stored.splice(0, stored.length - 20);
    localStorage.setItem("mandados_my_orders", JSON.stringify(stored));
  } catch {}

  return order;
}

/** Obtener todos los pedidos (requiere auth: admin o repartidor). */
export async function getOrders() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[orders] getOrders error:", error);
    return [];
  }
  return data || [];
}

/** Obtener un pedido por ID (público, vía RLS anon_read_order_by_id). */
export async function getOrderById(id) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[orders] getOrderById error:", error);
    return null;
  }
  return data;
}

/**
 * Actualizar campos de un pedido (requiere auth: admin o repartidor asignado).
 */
export async function updateOrder(id, updates) {
  const sb = getSupabase();
  if (!sb) return null;

  const payload = {};
  if (updates.status != null) payload.status = updates.status;
  if (updates.payment_status != null) payload.payment_status = updates.payment_status;
  if (updates.payment_reference != null) payload.payment_reference = updates.payment_reference;
  if (updates.repartidor_id != null) payload.repartidor_id = updates.repartidor_id;
  if (updates.paid_at != null) payload.paid_at = updates.paid_at;
  if (updates.completed_at != null) payload.completed_at = updates.completed_at;
  if (updates.cancelled_at != null) payload.cancelled_at = updates.cancelled_at;

  const { data, error } = await sb
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[orders] updateOrder error:", error);
    return null;
  }
  return data;
}

/** Marcar pago como pagado. */
export async function markPaid(id) {
  return updateOrder(id, {
    payment_status: "pagado",
    paid_at: new Date().toISOString(),
  });
}

/** Marcar pedido como completado/entregado. */
export async function markCompleted(id) {
  return updateOrder(id, {
    status: "entregado",
    completed_at: new Date().toISOString(),
  });
}

/** Marcar pedido como cancelado. */
export async function markCancelled(id) {
  return updateOrder(id, {
    status: "cancelado",
    cancelled_at: new Date().toISOString(),
  });
}

/** Eliminar un pedido (admin). */
export async function deleteOrder(id) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("orders").delete().eq("id", id);
  if (error) console.error("[orders] deleteOrder error:", error);
}

/** Suscribirse a cambios en pedidos vía Supabase Realtime. */
export function subscribeOrders(handler) {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel("orders-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "mandados", table: "orders" },
      (payload) => handler(payload)
    )
    .subscribe();
  return () => {
    sb.removeChannel(channel);
  };
}

/** Construir URL de Google Maps a partir de la ubicación de un pedido. */
export function mapsLinkFor(order) {
  const lat = order?.address_lat;
  const lng = order?.address_lng;
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const q = [order?.address, order?.address_number].filter(Boolean).join(" ").trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export const constants = { ESTADOS, ESTADOS_PAGO };
