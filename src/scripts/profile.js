const STORAGE_KEY = "mandados_profile_v1";

const empty = () => ({ nombre: "", telefono: "", direccion: null });

export function getProfile() {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return {
      nombre: typeof data?.nombre === "string" ? data.nombre : "",
      telefono: typeof data?.telefono === "string" ? data.telefono : "",
      direccion: data?.direccion ?? null,
    };
  } catch {
    return empty();
  }
}

export function setProfile(patch) {
  if (typeof localStorage === "undefined") return;
  const current = getProfile();
  const next = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
