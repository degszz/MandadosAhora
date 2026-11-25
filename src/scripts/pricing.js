/**
 * Precios configurables desde el admin (tabla settings).
 *
 *  - service_fee_online:  costo de envío por servicio en horario normal
 *  - service_fee_offline: costo de envío del servicio 24hs fuera de horario
 *  - platform_fee_pct:    % de comisión sobre el ticket real (se cobra al final)
 *
 * getPricing() es sincrónico: devuelve el último valor leído (localStorage) o
 * los valores por defecto. loadPricing() lo refresca desde Supabase y emite
 * "pricing:change" en window si cambió algo.
 * La base calcula la comisión con el mismo porcentaje (migración 018), así
 * que lo que se muestra acá es solo informativo.
 */

export const DEFAULT_PRICING = {
  serviceFeeOnline: 2500,
  serviceFeeOffline: 3500,
  platformFeePct: 15,
};

const CACHE_KEY = "mandados_pricing_v1";
const KEYS = ["service_fee_online", "service_fee_offline", "platform_fee_pct"];

function sane(p) {
  const n = (v, d, min, max) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= min && x <= max ? x : d;
  };
  return {
    serviceFeeOnline: n(p?.serviceFeeOnline, DEFAULT_PRICING.serviceFeeOnline, 0, 1e7),
    serviceFeeOffline: n(p?.serviceFeeOffline, DEFAULT_PRICING.serviceFeeOffline, 0, 1e7),
    platformFeePct: n(p?.platformFeePct, DEFAULT_PRICING.platformFeePct, 0, 50),
  };
}

export function getPricing() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (c) return sane(c);
  } catch {}
  return { ...DEFAULT_PRICING };
}

/** Lee los precios de Supabase. Nunca tira error; devuelve lo vigente. */
export async function loadPricing() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const before = getPricing();
  if (!url || !key) return before;
  try {
    const res = await fetch(
      `${url}/rest/v1/settings?key=in.(${KEYS.join(",")})&select=key,value`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "mandados" } },
    );
    if (!res.ok) return before;
    const rows = await res.json();
    const raw = { ...before };
    rows.forEach((r) => {
      if (r.key === "service_fee_online") raw.serviceFeeOnline = r.value;
      if (r.key === "service_fee_offline") raw.serviceFeeOffline = r.value;
      if (r.key === "platform_fee_pct") raw.platformFeePct = r.value;
    });
    const next = sane(raw);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
    if (JSON.stringify(next) !== JSON.stringify(before)) {
      try { window.dispatchEvent(new CustomEvent("pricing:change", { detail: next })); } catch {}
    }
    return next;
  } catch {
    return before;
  }
}

/** Guarda en cache local (lo usa el admin después de guardar). */
export function setPricingCache(p) {
  const next = sane(p);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new CustomEvent("pricing:change", { detail: next })); } catch {}
  return next;
}

export const fmtARS = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
