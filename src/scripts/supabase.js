/**
 * Cliente Supabase para Mandados Ahora.
 *
 * Importante:
 *  - Las tablas viven en el schema `mandados` (no `public`) para no
 *    chocar con otro app que cohabita en este proyecto.
 *  - Por eso configuramos `db.schema = 'mandados'` por default.
 *  - El schema `mandados` debe estar en "Exposed Schemas" del dashboard
 *    (Settings → API → Exposed schemas). Si no, las queries devuelven 404.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Logueamos pero no rompemos el build estático
  console.warn(
    "[supabase] Falta PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY en .env. " +
    "Las features de repartidores/admin no van a funcionar hasta que las setees."
  );
}

let _client = null;

/** Cliente lazy singleton. Solo se crea en el navegador (no SSR). */
export function getSupabase() {
  if (typeof window === "undefined") return null;
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // OFF: el canje del code lo manejamos manualmente en /auth/callback
      // para evitar race con la detección automática (que rompe PKCE).
      detectSessionInUrl: false,
      flowType: "pkce",
      // Storage key dedicada para Mandados Ahora: evita colisión con el
      // otro app que cohabita en este proyecto Supabase (cloudweb).
      storageKey: "mandados-auth-token",
    },
    db: { schema: "mandados" },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _client;
}

/** Iniciar sesión con Google (Supabase OAuth). */
export async function signInWithGoogle(redirectPath = "/repartidor/panel") {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no configurado");
  // Guardamos el "next" en sessionStorage para no contaminar la query del
  // redirect_to (algunos allow-lists del dashboard rechazan params extra).
  try { sessionStorage.setItem("mandados:auth:next", redirectPath); } catch {}
  const redirectTo = `${window.location.origin}/auth/callback`;
  console.info("[supabase] signInWithGoogle → redirectTo:", redirectTo);
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

/** Devuelve la sesión actual o null. */
export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session ?? null;
}

/** Devuelve el profile de `mandados.profiles` del usuario actual. */
export async function getMyProfile() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[supabase] getMyProfile error:", error);
    return null;
  }
  return data;
}

/** Suscribirse a cambios de auth. Devuelve función de unsubscribe. */
export function onAuthChange(handler) {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    handler(event, session);
  });
  return () => data.subscription.unsubscribe();
}
