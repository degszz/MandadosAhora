/**
 * Estado del negocio (online/offline) y horario por servicio.
 *
 * Fuente: settings.business_open + settings.business_schedule + tabla schedules.
 * El último estado leído se guarda en localStorage para que el carrito y el
 * checkout puedan consultarlo de forma sincrónica (isOfflineNow).
 */

const CACHE_KEY = "mandados_business_status_v1";
const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 min
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function toMin(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isBusinessOnline(businessOpen, schedule, date = new Date()) {
  if (businessOpen === false) return false;
  if (!schedule) return true;
  const day = schedule[DAY_KEYS[date.getDay()]];
  if (!day) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= toMin(day.open) && mins <= toMin(day.close);
}

export function isServiceScheduleOpen(sched, date = new Date()) {
  if (!sched) return true; // sin horario propio: depende solo del negocio
  if (!sched.is_open) return false;
  const days = Array.isArray(sched.days_open) ? sched.days_open : [];
  if (!days.includes(DAY_KEYS[date.getDay()])) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= toMin(sched.open_time) && mins <= toMin(sched.close_time);
}

/** Lee estado del negocio y horarios por servicio. Nunca tira error. */
export async function fetchBusinessStatus() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const out = { online: true, schedules: [], ok: false };
  if (!url || !key) return out;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "mandados" };
  try {
    const [sRes, schRes] = await Promise.all([
      fetch(`${url}/rest/v1/settings?key=in.(business_open,business_schedule)&select=key,value`, { headers }),
      fetch(`${url}/rest/v1/schedules?select=*`, { headers }),
    ]);
    const settings = sRes.ok ? await sRes.json() : [];
    out.schedules = schRes.ok ? await schRes.json() : [];
    let open = true;
    let schedule = null;
    settings.forEach((s) => {
      if (s.key === "business_open") open = s.value;
      if (s.key === "business_schedule") schedule = s.value;
    });
    out.online = isBusinessOnline(open, schedule);
    out.ok = sRes.ok;
    if (out.ok) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ online: out.online, at: Date.now() })); } catch {}
    }
  } catch {}
  return out;
}

/**
 * ¿Estamos fuera de horario ahora? Sincrónico: usa el último estado leído
 * de Supabase; si no hay uno reciente, cae a la regla fija (antes de 8,
 * desde las 21 o domingo).
 */
export function isOfflineNow() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (c && Date.now() - c.at < CACHE_MAX_AGE) return !c.online;
  } catch {}
  const d = new Date();
  const h = d.getHours();
  return h < 8 || h >= 21 || d.getDay() === 0;
}
