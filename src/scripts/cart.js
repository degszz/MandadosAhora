const STORAGE_KEY = "mandados_cart_v1";
const EVENT_NAME = "cart:change";
const UPDATE_EVENT_NAME = "cart:update";
const WA_NUMBER = "2271415182";

function read() {
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

function write(items, { silent = false } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  const eventName = silent ? UPDATE_EVENT_NAME : EVENT_NAME;
  window.dispatchEvent(new CustomEvent(eventName, { detail: items }));
}

export function getItems() {
  return read();
}

export function count() {
  return read().length;
}

export function addItem(item) {
  const items = read();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: new Date().toISOString(),
    ...item,
  };
  items.push(entry);
  write(items);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cart:add", { detail: entry }));
  }
  return entry;
}

export function removeItem(id) {
  write(read().filter((it) => it.id !== id));
}

/**
 * Actualizar campos de un item del carrito sin disparar el re-render
 * principal — útil para inputs editables (descripción, negocio, cantidad).
 * Dispara "cart:update" en lugar de "cart:change".
 */
export function updateItem(id, patch) {
  const items = read();
  const idx = items.findIndex((it) => it.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch };
  write(items, { silent: true });
  return items[idx];
}

export function clear() {
  write([]);
}

export function subscribe(handler) {
  const wrapped = (e) => handler(e.detail ?? read());
  window.addEventListener(EVENT_NAME, wrapped);
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) handler(read());
  });
  return () => window.removeEventListener(EVENT_NAME, wrapped);
}

/** Suscripción a actualizaciones in-place de items (no re-render visual). */
export function subscribeUpdates(handler) {
  const wrapped = (e) => handler(e.detail ?? read());
  window.addEventListener(UPDATE_EVENT_NAME, wrapped);
  return () => window.removeEventListener(UPDATE_EVENT_NAME, wrapped);
}

export function formatItem(item, index) {
  const lines = [];
  lines.push(`*${index}. ${item.servicio}*`);
  // Compat: aceptar tanto los nombres nuevos (negocio/descripcion) como los viejos (contacto/detalles)
  const negocio = item.negocio || item.contacto || "";
  const descripcion = item.descripcion || item.detalles || "";
  const cantidad = item.cantidad ?? 1;
  if (negocio) lines.push(`🏬 Negocio: ${negocio}`);
  if (descripcion) lines.push(`📝 Descripción:\n${descripcion}`);
  if (cantidad && cantidad !== 1) lines.push(`🔢 Cantidad: ${cantidad}`);
  if (item.nombre) lines.push(`👤 Nombre: ${item.nombre}`);
  if (item.direccion) {
    if (typeof item.direccion === "string") {
      lines.push(`📍 Dirección: ${item.direccion}`);
    } else {
      const dirTxt = item.direccion.address || item.direccion.texto || "";
      if (dirTxt) lines.push(`📍 Dirección: ${dirTxt}`);
      if (item.direccion.lat != null && item.direccion.lng != null) {
        lines.push(`🗺️ https://www.google.com/maps/search/?api=1&query=${item.direccion.lat},${item.direccion.lng}`);
      }
    }
  }
  if (Array.isArray(item.extras) && item.extras.length) {
    item.extras.forEach((ex, i) => {
      lines.push(`------------------------------`);
      const exN = ex.negocio || ex.contacto || "";
      const exD = ex.descripcion || ex.detalles || "";
      if (exN) lines.push(`🏬 Negocio ${i + 2}: ${exN}`);
      if (exD) lines.push(`📝 Descripción:\n${exD}`);
    });
  }
  if (item.pago) lines.push(`💳 Método de pago: ${item.pago}`);
  if (item.costo) lines.push(`💲 Precio del Servicio: ${item.costo}`);
  return lines.join("\n");
}

export function buildWhatsappUrl() {
  const items = read();
  if (!items.length) return null;
  const header = `🛒 *Nuevo pedido — Mandados Ahora*\nTotal de servicios: ${items.length}\n`;
  const body = items.map((it, i) => formatItem(it, i + 1)).join("\n\n");
  const msg = `${header}\n${body}`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

if (typeof window !== "undefined") {
  window.MandadosCart = {
    getItems,
    count,
    addItem,
    removeItem,
    updateItem,
    clear,
    subscribe,
    subscribeUpdates,
    buildWhatsappUrl,
  };
}
