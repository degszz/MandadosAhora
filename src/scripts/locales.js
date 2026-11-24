/**
 * Directorio de locales de comida ("¿Qué comemos?").
 *
 * Mandados Ahora solo muestra los locales y sus contactos. El pedido se
 * hace directo con el local (WhatsApp / Instagram / web).
 * Datos en Supabase: tabla `mandados.locales_comida` (migración 009).
 */
import { getSupabase } from "./supabase.js";

export const CATEGORIAS = [
  { nombre: "Hamburguesas", emoji: "🍔" },
  { nombre: "Pizzas", emoji: "🍕" },
  { nombre: "Milanesas", emoji: "🥩" },
  { nombre: "Empanadas", emoji: "🥟" },
  { nombre: "Sushi", emoji: "🍣" },
  { nombre: "Pastas", emoji: "🍝" },
  { nombre: "Parrilla", emoji: "🔥" },
  { nombre: "Comida casera", emoji: "🍲" },
  { nombre: "Dulces y postres", emoji: "🍰" },
  { nombre: "Cafetería", emoji: "☕" },
  { nombre: "Saludable", emoji: "🥗" },
  { nombre: "Otros", emoji: "🍽️" },
];

export function emojiFor(categoria) {
  return CATEGORIAS.find((c) => c.nombre === categoria)?.emoji || "🍽️";
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function toMin(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * ¿Está abierto en `date`? Soporta horarios que pasan la medianoche
 * (ej. 20:00 a 00:30). Devuelve null si el local no cargó horario.
 */
export function isOpenNow(horario, date = new Date()) {
  if (!horario) return null;
  const mins = date.getHours() * 60 + date.getMinutes();
  const today = horario[DAY_KEYS[date.getDay()]];
  const yesterday = horario[DAY_KEYS[(date.getDay() + 6) % 7]];

  if (today) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (c > o ? mins >= o && mins < c : mins >= o) return true;
  }
  // Turno de ayer que sigue después de medianoche
  if (yesterday) {
    const o = toMin(yesterday.open);
    const c = toMin(yesterday.close);
    if (c <= o && mins < c) return true;
  }
  return false;
}

/** Texto corto con el horario de hoy, ej "20:00 – 00:30" o "Hoy cerrado". */
export function horarioHoy(horario, date = new Date()) {
  if (!horario) return "";
  const today = horario[DAY_KEYS[date.getDay()]];
  return today ? `${today.open} – ${today.close}` : "Hoy cerrado";
}

/** Link de WhatsApp. Acepta "2271 41-5182", "+54 9 2271..." etc. */
export function waLink(numero, texto = "") {
  let d = String(numero || "").replace(/\D/g, "");
  if (!d) return null;
  if (!d.startsWith("54")) d = "549" + d;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function igLink(usuario) {
  const u = String(usuario || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
  return u ? `https://instagram.com/${u}` : null;
}

/** Solo URLs http(s): evita javascript: y similares en datos cargados a mano. */
export function safeUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export async function fetchLocales({ incluirInactivos = false } = {}) {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from("locales_comida").select("*").order("orden").order("nombre");
  if (!incluirInactivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) {
    console.warn("[locales] fetch error:", error.message);
    return [];
  }
  return data || [];
}
