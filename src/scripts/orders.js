/**
 * Servicio de pedidos — Mandados Ahora
 *
 * Capa de datos separada para facilitar migración a backend.
 * Actualmente usa localStorage. Para migrar a un backend real,
 * reemplazar readAll() / writeAll() por llamadas fetch() y
 * mantener la misma firma pública (createOrder, getOrders, etc.).
 */

const STORAGE_KEY = "mandados_orders_v1";
const EVENT_NAME = "orders:change";

const ESTADOS = ["pendiente", "completado", "cancelado"];
const ESTADOS_PAGO = ["pendiente", "pagado", "rechazado"];

function readAll() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAll(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: orders }));
  }
}

function genId() {
  return `ped_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Crear un nuevo pedido.
 * @param {Object} data
 * @param {Array}  data.servicios   Items del carrito
 * @param {String} data.nombre      Nombre del cliente
 * @param {Object} data.ubicacion   { tipo, direccion, numero?, lat?, lng? }
 * @param {Object} data.pago        { metodo, monto }
 * @returns {Object} pedido creado
 */
export function createOrder(data) {
  const orders = readAll();
  const order = {
    id: genId(),
    createdAt: new Date().toISOString(),
    servicios: data.servicios || [],
    cliente: { nombre: data.nombre || "" },
    ubicacion: {
      tipo: data.ubicacion?.tipo || "manual",
      direccion: data.ubicacion?.direccion || "",
      numero: data.ubicacion?.numero || "",
      lat: data.ubicacion?.lat ?? null,
      lng: data.ubicacion?.lng ?? null,
    },
    pago: {
      metodo: data.pago?.metodo || "efectivo",
      monto: data.pago?.monto ?? 0,
      estado: data.pago?.metodo === "transferencia" ? "pendiente" : "pendiente",
      preferenceId: data.pago?.preferenceId || null,
      paymentUrl: data.pago?.paymentUrl || null,
    },
    estado: "pendiente",
  };
  orders.unshift(order);
  writeAll(orders);
  return order;
}

/** Obtener todos los pedidos (más recientes primero). */
export function getOrders() {
  return readAll();
}

/** Obtener un pedido por ID. */
export function getOrderById(id) {
  return readAll().find((o) => o.id === id) || null;
}

/**
 * Actualizar campos de un pedido.
 * Soporta merge en sub-objetos (pago, ubicacion, cliente).
 */
export function updateOrder(id, updates) {
  const orders = readAll();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;

  const nested = ["pago", "ubicacion", "cliente"];
  const u = { ...updates };
  for (const key of nested) {
    if (u[key]) {
      orders[idx][key] = { ...orders[idx][key], ...u[key] };
      delete u[key];
    }
  }
  Object.assign(orders[idx], u);
  writeAll(orders);
  return orders[idx];
}

/** Marcar pago como pagado. */
export function markPaid(id) {
  return updateOrder(id, { pago: { estado: "pagado", paidAt: new Date().toISOString() } });
}

/** Marcar pedido como completado. */
export function markCompleted(id) {
  return updateOrder(id, { estado: "completado", completedAt: new Date().toISOString() });
}

/** Marcar pedido como cancelado. */
export function markCancelled(id) {
  return updateOrder(id, { estado: "cancelado", cancelledAt: new Date().toISOString() });
}

/** Eliminar un pedido. */
export function deleteOrder(id) {
  writeAll(readAll().filter((o) => o.id !== id));
}

/** Suscribirse a cambios en pedidos (útil para el panel admin). */
export function subscribeOrders(handler) {
  if (typeof window === "undefined") return () => {};
  const wrapped = (e) => handler(e.detail ?? readAll());
  window.addEventListener(EVENT_NAME, wrapped);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) handler(readAll());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, wrapped);
    window.removeEventListener("storage", onStorage);
  };
}

/** Construir URL de Google Maps a partir de la ubicación de un pedido. */
export function mapsLinkFor(order) {
  const u = order?.ubicacion;
  if (!u) return null;
  if (u.lat != null && u.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}`;
  }
  const q = [u.direccion, u.numero].filter(Boolean).join(" ").trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export const constants = { ESTADOS, ESTADOS_PAGO };
