import { useEffect, useState, useMemo, useCallback } from "preact/hooks";
import { getSupabase } from "../scripts/supabase.js";
import { CATEGORIAS, emojiFor, isOpenNow } from "../scripts/locales.js";

/**
 * Tab "Comida" del admin: alta, edición y baja de locales del directorio
 * "¿Qué comemos?" (tabla mandados.locales_comida).
 */

const DIAS = [
  { key: "monday", label: "Lun" },
  { key: "tuesday", label: "Mar" },
  { key: "wednesday", label: "Mié" },
  { key: "thursday", label: "Jue" },
  { key: "friday", label: "Vie" },
  { key: "saturday", label: "Sáb" },
  { key: "sunday", label: "Dom" },
];

const VACIO = {
  nombre: "",
  categoria: "Hamburguesas",
  descripcion: "",
  logo_url: "",
  web_url: "",
  whatsapp: "",
  instagram: "",
  delivery_propio: false,
  horario: null,
  activo: true,
  orden: 0,
};

const input = "width:100%;font-size:0.85rem;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.6rem;color:#1f2937;box-sizing:border-box";
const label = "display:block;font-size:0.72rem;font-weight:600;color:#6b7280;margin-bottom:0.25rem";

export default function LocalesAdmin() {
  const sb = useMemo(() => getSupabase(), []);
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = cerrado; objeto = editando/creando
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const cargar = useCallback(async () => {
    if (!sb) return;
    setLoading(true);
    const { data, error } = await sb.from("locales_comida").select("*").order("orden").order("nombre");
    if (error) setErr(error.message);
    setLocales(data || []);
    setLoading(false);
  }, [sb]);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDia = (key) =>
    setForm((f) => {
      const h = { ...(f.horario || {}) };
      h[key] = h[key] ? null : { open: "20:00", close: "23:59" };
      return { ...f, horario: h };
    });

  const setHora = (key, campo, valor) =>
    setForm((f) => ({ ...f, horario: { ...f.horario, [key]: { ...f.horario[key], [campo]: valor } } }));

  const guardar = async () => {
    if (!form.nombre.trim()) return setErr("Falta el nombre del local.");
    if (!form.whatsapp && !form.instagram && !form.web_url) return setErr("Cargá al menos un contacto: WhatsApp, Instagram o web.");
    setSaving(true);
    setErr(null);
    const { id, created_at, ...rest } = form;
    const payload = {
      ...rest,
      nombre: rest.nombre.trim(),
      descripcion: rest.descripcion?.trim() || null,
      logo_url: rest.logo_url?.trim() || null,
      web_url: rest.web_url?.trim() || null,
      whatsapp: rest.whatsapp?.replace(/\D/g, "") || null,
      instagram: rest.instagram?.trim().replace(/^@/, "") || null,
      orden: Number(rest.orden) || 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await sb.from("locales_comida").update(payload).eq("id", id)
      : await sb.from("locales_comida").insert(payload);
    setSaving(false);
    if (error) return setErr(error.message);
    setForm(null);
    cargar();
  };

  const toggleActivo = async (l) => {
    await sb.from("locales_comida").update({ activo: !l.activo, updated_at: new Date().toISOString() }).eq("id", l.id);
    cargar();
  };

  const borrar = async (l) => {
    if (!confirm(`¿Borrar "${l.nombre}" del directorio? Esto no se puede deshacer. (Para ocultarlo un tiempo usá "Ocultar".)`)) return;
    await sb.from("locales_comida").delete().eq("id", l.id);
    cargar();
  };

  return (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem">
        <div>
          <h2 style="font-size:1.1rem;font-weight:700;color:#1f2937;margin:0">🍔 Locales de comida</h2>
          <p style="font-size:0.78rem;color:#6b7280;margin:0.2rem 0 0">
            Se muestran en <a href="/comida" target="_blank" style="color:#377DEC">/comida</a>. El pedido lo hace el cliente directo con el local.
          </p>
        </div>
        {!form && (
          <button onClick={() => { setErr(null); setForm({ ...VACIO }); }} style="background:#ea580c;color:#fff;border:none;border-radius:0.5rem;padding:0.55rem 1rem;font-weight:600;font-size:0.85rem;cursor:pointer">
            + Agregar local
          </button>
        )}
      </div>

      {err && <p style="font-size:0.82rem;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:0.5rem;padding:0.5rem 0.75rem;margin-bottom:0.75rem">⚠️ {err}</p>}

      {form && (
        <div style="background:#fff;border:1.5px solid #fed7aa;border-radius:0.875rem;padding:1rem;margin-bottom:1.25rem">
          <h3 style="font-size:0.95rem;font-weight:700;margin:0 0 0.75rem;color:#1f2937">{form.id ? "Editar local" : "Nuevo local"}</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.65rem">
            <div><span style={label}>Nombre *</span><input style={input} value={form.nombre} onInput={(e) => set("nombre", e.target.value)} maxLength={80} /></div>
            <div>
              <span style={label}>Tipo de comida *</span>
              <select style={input} value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
                {CATEGORIAS.map((c) => <option value={c.nombre}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
            <div><span style={label}>WhatsApp (con código de área)</span><input style={input} value={form.whatsapp || ""} onInput={(e) => set("whatsapp", e.target.value)} placeholder="2271 41-5182" inputMode="tel" /></div>
            <div><span style={label}>Instagram</span><input style={input} value={form.instagram || ""} onInput={(e) => set("instagram", e.target.value)} placeholder="@nombredellocal" /></div>
            <div><span style={label}>Web o menú online</span><input style={input} value={form.web_url || ""} onInput={(e) => set("web_url", e.target.value)} placeholder="https://..." type="url" /></div>
            <div><span style={label}>Logo (URL de imagen)</span><input style={input} value={form.logo_url || ""} onInput={(e) => set("logo_url", e.target.value)} placeholder="https://..." type="url" /></div>
          </div>
          <div style="margin-top:0.65rem">
            <span style={label}>Descripción corta (máx. 200)</span>
            <textarea style={`${input};resize:vertical`} rows={2} maxLength={200} value={form.descripcion || ""} onInput={(e) => set("descripcion", e.target.value)} placeholder="Hamburguesas smash, papas con cheddar..." />
          </div>
          <div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-top:0.65rem;font-size:0.85rem;color:#374151">
            <label style="display:flex;gap:0.4rem;align-items:center;cursor:pointer"><input type="checkbox" checked={form.delivery_propio} onChange={(e) => set("delivery_propio", e.target.checked)} /> Tiene delivery propio</label>
            <label style="display:flex;gap:0.4rem;align-items:center;cursor:pointer"><input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} /> Visible en la web</label>
            <label style="display:flex;gap:0.4rem;align-items:center">Orden <input type="number" style={`${input};width:70px`} value={form.orden} onInput={(e) => set("orden", e.target.value)} /></label>
          </div>

          <div style="margin-top:0.85rem">
            <span style={label}>Horario (si un día pasa la medianoche, poné el cierre de madrugada, ej. 20:00 a 00:30)</span>
            <div style="display:flex;flex-direction:column;gap:0.3rem">
              {DIAS.map((d) => {
                const h = form.horario?.[d.key];
                return (
                  <div style="display:flex;align-items:center;gap:0.5rem;background:#f9fafb;border-radius:0.4rem;padding:0.3rem 0.5rem">
                    <label style="display:flex;align-items:center;gap:0.35rem;min-width:70px;font-size:0.82rem;font-weight:600;color:#374151;cursor:pointer">
                      <input type="checkbox" checked={!!h} onChange={() => toggleDia(d.key)} /> {d.label}
                    </label>
                    {h ? (
                      <>
                        <input type="time" value={h.open} onChange={(e) => setHora(d.key, "open", e.target.value)} style="font-size:0.8rem;border:1px solid #e5e7eb;border-radius:0.35rem;padding:0.15rem 0.3rem" />
                        <span style="font-size:0.75rem;color:#9ca3af">a</span>
                        <input type="time" value={h.close} onChange={(e) => setHora(d.key, "close", e.target.value)} style="font-size:0.8rem;border:1px solid #e5e7eb;border-radius:0.35rem;padding:0.15rem 0.3rem" />
                      </>
                    ) : (
                      <span style="font-size:0.75rem;color:#9ca3af;font-style:italic">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p style="font-size:0.7rem;color:#9ca3af;margin:0.3rem 0 0">Si no marcás ningún día, el local aparece sin estado abierto/cerrado.</p>
          </div>

          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem">
            <button onClick={() => { setForm(null); setErr(null); }} style="background:#fff;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 1rem;font-size:0.85rem;cursor:pointer;color:#6b7280">Cancelar</button>
            <button onClick={guardar} disabled={saving} style={`background:#ea580c;color:#fff;border:none;border-radius:0.5rem;padding:0.5rem 1.2rem;font-weight:600;font-size:0.85rem;cursor:pointer;opacity:${saving ? 0.6 : 1}`}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style="color:#9ca3af;font-size:0.85rem">Cargando...</p>
      ) : locales.length === 0 ? (
        <p style="color:#6b7280;font-size:0.85rem;background:#fff;border:1px dashed #e5e7eb;border-radius:0.75rem;padding:1.5rem;text-align:center">Todavía no cargaste locales.</p>
      ) : (
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          {locales.map((l) => {
            const abierto = isOpenNow(l.horario);
            return (
              <div style={`background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.7rem 0.85rem;display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;opacity:${l.activo ? 1 : 0.55}`}>
                <span style="font-size:1.5rem">{emojiFor(l.categoria)}</span>
                <div style="flex:1;min-width:160px">
                  <p style="font-weight:700;color:#1f2937;margin:0;font-size:0.9rem">
                    {l.nombre} {!l.activo && <span style="font-size:0.68rem;color:#6b7280;font-weight:600">(oculto)</span>}
                  </p>
                  <p style="font-size:0.72rem;color:#6b7280;margin:0.1rem 0 0">
                    {l.categoria} · {l.delivery_propio ? "Con delivery" : "Solo retiro"}
                    {abierto !== null && (abierto ? " · 🟢 Abierto" : " · 🔴 Cerrado")}
                  </p>
                </div>
                <div style="display:flex;gap:0.35rem">
                  <button onClick={() => { setErr(null); setForm({ ...VACIO, ...l }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style="font-size:0.75rem;padding:0.35rem 0.7rem;border-radius:0.4rem;border:1px solid #bfd7ff;background:#EBF3FF;color:#1e40af;cursor:pointer">Editar</button>
                  <button onClick={() => toggleActivo(l)} style="font-size:0.75rem;padding:0.35rem 0.7rem;border-radius:0.4rem;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer">{l.activo ? "Ocultar" : "Mostrar"}</button>
                  <button onClick={() => borrar(l)} style="font-size:0.75rem;padding:0.35rem 0.7rem;border-radius:0.4rem;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;cursor:pointer">Borrar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
