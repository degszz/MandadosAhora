import { useEffect, useState, useMemo, useCallback } from "preact/hooks";
import { getSupabase, getMyProfile, signOut } from "../scripts/supabase.js";
import RepartidorPanel from "./RepartidorPanel.jsx";

/**
 * Panel admin (modo Google OAuth).
 *
 * Tabs:
 *  1. Repartidores pendientes (verify / reject)
 *  2. Pedidos (Supabase) — reusa <RepartidorPanel mode="admin" />
 *  3. Pedidos legacy (localStorage) — link al panel viejo
 */
export default function AdminPanel() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("repartidores");
  const [hiringActive, setHiringActive] = useState(false);
  const [hiringLoading, setHiringLoading] = useState(false);
  const PRICE_PER_SERVICE = 3000;
  const sb = useMemo(() => getSupabase(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sb) {
        setError("Supabase no configurado");
        setLoading(false);
        return;
      }
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setError("no_session");
        setLoading(false);
        return;
      }
      const p = await getMyProfile();
      if (cancelled) return;
      if (!p || p.role !== "admin") {
        setError("Tu cuenta no es admin.");
        setLoading(false);
        return;
      }
      setProfile(p);
      setLoading(false);
      // Leer setting de hiring
      sb.from("settings").select("value").eq("key", "hiring_active").single()
        .then(({ data }) => { if (data) setHiringActive(data.value === true); });
    })();
    return () => { cancelled = true; };
  }, [sb]);

  const logout = async () => {
    await signOut();
    location.reload();
  };

  const toggleHiring = async () => {
    if (!sb || hiringLoading) return;
    setHiringLoading(true);
    const newVal = !hiringActive;
    const { error: e } = await sb.from("settings").update({ value: newVal, updated_at: new Date().toISOString() }).eq("key", "hiring_active");
    if (!e) setHiringActive(newVal);
    setHiringLoading(false);
  };

  if (loading) {
    return (
      <div style="text-align:center;padding:3rem 1rem">
        <div style="width:38px;height:38px;margin:0 auto 0.75rem;border-radius:9999px;border:4px solid rgba(55,125,236,0.2);border-top-color:#377DEC;animation:spin 0.8s linear infinite"></div>
        <p style="color:#6b7280;font-size:0.85rem">Validando sesión...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error === "no_session") return null; // fallthrough: admin.astro muestra login

  if (error) {
    return (
      <div style="background:#fff;border:1px solid #fecaca;border-radius:1rem;padding:2rem;text-align:center;max-width:32rem;margin:0 auto">
        <h2 style="color:#b91c1c;font-weight:700;margin-bottom:0.5rem">No se puede acceder</h2>
        <p style="color:#7f1d1d;font-size:0.875rem;margin-bottom:1rem">{error}</p>
        <button onClick={logout} style="background:#377DEC;color:#fff;border:none;border-radius:0.5rem;padding:0.55rem 1.2rem;font-weight:600;cursor:pointer">
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div style="width:100%">
      {/* Header */}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div>
          <h1 style="font-size:1.5rem;font-weight:700;color:#1f2937">🛡 Panel admin</h1>
          <p style="font-size:0.8rem;color:#6b7280;margin-top:0.15rem">
            {profile.full_name || profile.email}
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
          {/* Toggle: buscamos repartidores */}
          <button
            onClick={toggleHiring}
            disabled={hiringLoading}
            style={`display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;font-weight:600;padding:0.4rem 0.85rem;border-radius:0.5rem;cursor:pointer;border:1px solid ${hiringActive ? "#bbf7d0" : "#e5e7eb"};background:${hiringActive ? "#f0fdf4" : "#fff"};color:${hiringActive ? "#166534" : "#6b7280"};transition:all .2s;opacity:${hiringLoading ? "0.5" : "1"}`}
          >
            <span style={`display:inline-block;width:32px;height:18px;border-radius:9px;background:${hiringActive ? "#22c55e" : "#d1d5db"};position:relative;transition:background .2s`}>
              <span style={`position:absolute;top:2px;left:${hiringActive ? "16px" : "2px"};width:14px;height:14px;border-radius:7px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);transition:left .2s`}></span>
            </span>
            🛵 {hiringActive ? "Buscando repartidores" : "Repartidores desactivado"}
          </button>

          <button
            onClick={logout}
            style="font-size:0.8rem;color:#6b7280;background:#fff;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.4rem 0.75rem;cursor:pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Business Status Control */}
      <BusinessStatusControl />

      {/* Tabs */}
      <div style="display:flex;gap:0.4rem;margin-bottom:1.25rem;border-bottom:1px solid #e5e7eb;flex-wrap:wrap">
        {[
          { id: "repartidores", label: "👥 Repartidores" },
          { id: "pedidos",      label: "📦 Pedidos" },
          { id: "horarios",     label: "🕐 Horarios" },
          { id: "resumen",      label: "💰 Resumen" },
          { id: "legacy",       label: "🗂 Legacy" },
        ].map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={`background:none;border:none;cursor:pointer;font-size:0.88rem;font-weight:${active ? "700" : "500"};color:${active ? "#377DEC" : "#6b7280"};padding:0.55rem 0.85rem;border-bottom:2px solid ${active ? "#377DEC" : "transparent"};margin-bottom:-1px`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "repartidores" && <RepartidoresPendientes profile={profile} />}
      {tab === "pedidos" && <RepartidorPanel mode="admin" todayOnly={false} />}
      {tab === "horarios" && <HorariosPanel />}
      {tab === "resumen" && <ResumenDiario />}
      {tab === "legacy" && <LegacyTab />}
    </div>
  );
}

// ============================================================
// BusinessStatusControl — toggle online/offline + horarios semanales
// ============================================================
const DIAS_SEMANA = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

function BusinessStatusControl() {
  const [open, setOpen] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sb = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!sb) return;
    sb.from("settings").select("key,value").in("key", ["business_open", "business_schedule"])
      .then(({ data }) => {
        if (data) data.forEach((r) => {
          if (r.key === "business_open") setOpen(r.value === true);
          if (r.key === "business_schedule") setSchedule(r.value);
        });
        setLoading(false);
      });
  }, [sb]);

  const toggleOpen = async () => {
    if (!sb || saving) return;
    setSaving(true);
    const newVal = !open;
    await sb.from("settings").update({ value: newVal, updated_at: new Date().toISOString() }).eq("key", "business_open");
    setOpen(newVal);
    setSaving(false);
  };

  const updateScheduleDay = (dayKey, field, value) => {
    setSchedule((prev) => {
      const s = { ...(prev || {}) };
      if (value === null) {
        s[dayKey] = null;
      } else {
        s[dayKey] = { ...(s[dayKey] || { open: "08:00", close: "21:00" }), [field]: value };
      }
      return s;
    });
  };

  const toggleDay = (dayKey) => {
    setSchedule((prev) => {
      const s = { ...(prev || {}) };
      if (s[dayKey]) {
        s[dayKey] = null;
      } else {
        s[dayKey] = { open: "08:00", close: "21:00" };
      }
      return s;
    });
  };

  const saveSchedule = async () => {
    if (!sb) return;
    setSaving(true);
    await sb.from("settings").update({ value: schedule, updated_at: new Date().toISOString() }).eq("key", "business_schedule");
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:1rem;margin-bottom:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
        {/* Toggle online/offline */}
        <div style="display:flex;align-items:center;gap:0.65rem">
          <button
            onClick={toggleOpen}
            disabled={saving}
            style={`display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:700;padding:0.5rem 1rem;border-radius:0.625rem;cursor:pointer;border:1.5px solid ${open ? "#bbf7d0" : "#fecaca"};background:${open ? "#f0fdf4" : "#fef2f2"};color:${open ? "#166534" : "#991b1b"};transition:all .2s;opacity:${saving ? "0.5" : "1"}`}
          >
            <span style={`display:inline-block;width:36px;height:20px;border-radius:10px;background:${open ? "#22c55e" : "#ef4444"};position:relative;transition:background .2s`}>
              <span style={`position:absolute;top:2px;left:${open ? "18px" : "2px"};width:16px;height:16px;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.15);transition:left .2s`}></span>
            </span>
            <span style={`width:8px;height:8px;border-radius:50%;background:${open ? "#22c55e" : "#ef4444"}`}></span>
            {open ? "Online" : "Offline"}
          </button>
          <span style="font-size:0.75rem;color:#6b7280">
            {open ? "Los clientes pueden hacer pedidos" : "Solo 24hs disponible"}
          </span>
        </div>

        {/* Botón horarios */}
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          style="font-size:0.78rem;color:#377DEC;font-weight:600;background:#EBF3FF;border:1px solid #bfd7ff;border-radius:0.5rem;padding:0.4rem 0.85rem;cursor:pointer;display:flex;align-items:center;gap:0.35rem"
        >
          🕐 Horarios semanales
          <span style={`transition:transform .2s;display:inline-block;transform:rotate(${showSchedule ? "180" : "0"}deg)`}>▼</span>
        </button>
      </div>

      {/* Panel de horarios semanales */}
      {showSchedule && (
        <div style="margin-top:0.85rem;border-top:1px solid #f3f4f6;padding-top:0.85rem">
          <p style="font-size:0.72rem;color:#9ca3af;margin:0 0 0.6rem">
            Definí los horarios de apertura. Fuera de estos horarios, el sitio aparece como Offline y solo se muestra 24hs.
          </p>
          <div style="display:flex;flex-direction:column;gap:0.4rem">
            {DIAS_SEMANA.map((dia) => {
              const dayData = schedule?.[dia.key];
              const isActive = !!dayData;
              return (
                <div key={dia.key} style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;background:#f9fafb;border-radius:0.5rem;flex-wrap:wrap">
                  <button
                    onClick={() => toggleDay(dia.key)}
                    style={`width:28px;height:16px;border-radius:8px;border:none;cursor:pointer;background:${isActive ? "#22c55e" : "#d1d5db"};position:relative;flex-shrink:0`}
                  >
                    <span style={`position:absolute;top:1.5px;left:${isActive ? "13px" : "1.5px"};width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 0.5px 1px rgba(0,0,0,0.15);transition:left .15s`}></span>
                  </button>
                  <span style={`font-size:0.8rem;font-weight:600;color:${isActive ? "#1f2937" : "#9ca3af"};min-width:75px`}>
                    {dia.label}
                  </span>
                  {isActive ? (
                    <div style="display:flex;align-items:center;gap:0.3rem">
                      <input
                        type="time"
                        value={dayData.open || "08:00"}
                        onChange={(e) => updateScheduleDay(dia.key, "open", e.target.value)}
                        style="font-size:0.78rem;border:1px solid #e5e7eb;border-radius:0.35rem;padding:0.2rem 0.35rem;color:#374151;width:90px"
                      />
                      <span style="font-size:0.75rem;color:#9ca3af">a</span>
                      <input
                        type="time"
                        value={dayData.close || "21:00"}
                        onChange={(e) => updateScheduleDay(dia.key, "close", e.target.value)}
                        style="font-size:0.78rem;border:1px solid #e5e7eb;border-radius:0.35rem;padding:0.2rem 0.35rem;color:#374151;width:90px"
                      />
                    </div>
                  ) : (
                    <span style="font-size:0.72rem;color:#9ca3af;font-style:italic">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style="margin-top:0.65rem;display:flex;justify-content:flex-end">
            <button
              onClick={saveSchedule}
              disabled={saving}
              style={`font-size:0.8rem;font-weight:600;background:#377DEC;color:#fff;border:none;border-radius:0.5rem;padding:0.5rem 1.2rem;cursor:pointer;opacity:${saving ? "0.5" : "1"}`}
            >
              {saving ? "Guardando..." : "Guardar horarios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// RepartidoresPendientes
// ============================================================
function RepartidoresPendientes({ profile }) {
  const [list, setList] = useState({ pending: [], verified: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);
  const sb = useMemo(() => getSupabase(), []);

  const fetchAll = useCallback(async () => {
    if (!sb) return;
    setLoading(true);
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("role", "repartidor")
      .order("created_at", { ascending: false });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const pending = (data || []).filter((p) => !p.verified);
    const verified = (data || []).filter((p) => p.verified);
    setList({ pending, verified });
    setLoading(false);
  }, [sb]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // realtime updates
  useEffect(() => {
    if (!sb) return;
    const ch = sb
      .channel("profiles-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "mandados", table: "profiles" },
        () => fetchAll()
      )
      .subscribe();
    return () => { try { ch.unsubscribe(); } catch {} };
  }, [sb, fetchAll]);

  const verify = async (id) => {
    setBusyId(id);
    setErr(null);
    const { error } = await sb.from("profiles").update({ verified: true }).eq("id", id);
    if (error) setErr(error.message);
    await fetchAll();
    setBusyId(null);
  };

  const unverify = async (id) => {
    if (!confirm("¿Quitar la verificación a este repartidor?")) return;
    setBusyId(id);
    const { error } = await sb.from("profiles").update({ verified: false }).eq("id", id);
    if (error) setErr(error.message);
    await fetchAll();
    setBusyId(null);
  };

  const reject = async (id) => {
    if (!confirm("¿Eliminar el perfil de este repartidor? Esta acción no se puede deshacer.")) return;
    setBusyId(id);
    setErr(null);
    const { error } = await sb.from("profiles").delete().eq("id", id);
    if (error) setErr(error.message);
    await fetchAll();
    setBusyId(null);
  };

  if (loading) return <p style="color:#6b7280;font-size:0.875rem;padding:1rem">Cargando repartidores...</p>;

  return (
    <div>
      {err && (
        <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:0.6rem 0.75rem;border-radius:0.5rem;margin-bottom:0.75rem;font-size:0.85rem">
          ⚠️ {err}
        </div>
      )}

      <h2 style="font-size:1rem;font-weight:600;color:#374151;margin:0 0 0.6rem">
        ⏳ Pendientes ({list.pending.length})
      </h2>
      {list.pending.length === 0 ? (
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:1.25rem;text-align:center;color:#9ca3af;font-size:0.85rem;margin-bottom:1.5rem">
          No hay repartidores esperando verificación.
        </div>
      ) : (
        <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1.75rem">
          {list.pending.map((r) => (
            <RepCard
              key={r.id}
              rep={r}
              busy={busyId === r.id}
              actions={[
                { label: "✓ Verificar", onClick: () => verify(r.id), variant: "primary" },
                { label: "✕ Rechazar", onClick: () => reject(r.id), variant: "danger" },
              ]}
            />
          ))}
        </div>
      )}

      <h2 style="font-size:1rem;font-weight:600;color:#374151;margin:0 0 0.6rem">
        ✅ Verificados ({list.verified.length})
      </h2>
      {list.verified.length === 0 ? (
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:1.25rem;text-align:center;color:#9ca3af;font-size:0.85rem">
          Sin repartidores verificados todavía.
        </div>
      ) : (
        <div style="display:flex;flex-direction:column;gap:0.6rem">
          {list.verified.map((r) => (
            <RepCard
              key={r.id}
              rep={r}
              busy={busyId === r.id}
              actions={[
                { label: "Quitar verificación", onClick: () => unverify(r.id), variant: "ghost" },
                { label: "Eliminar", onClick: () => reject(r.id), variant: "danger" },
              ]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepCard({ rep, busy, actions }) {
  return (
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.75rem 0.875rem;display:flex;justify-content:space-between;gap:0.6rem;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:0.6rem;min-width:0">
        {rep.avatar_url ? (
          <img src={rep.avatar_url} alt="" referrerpolicy="no-referrer" style="width:36px;height:36px;border-radius:9999px;object-fit:cover;flex-shrink:0" />
        ) : (
          <div style="width:36px;height:36px;border-radius:9999px;background:#EBF3FF;color:#377DEC;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            {(rep.full_name || rep.email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style="min-width:0">
          <p style="font-weight:600;color:#1f2937;font-size:0.88rem;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            {rep.full_name || rep.email}
          </p>
          <p style="color:#6b7280;font-size:0.72rem;margin:0">
            {rep.email} · registrado {new Date(rep.created_at).toLocaleDateString("es-AR")}
          </p>
        </div>
      </div>
      <div style="display:flex;gap:0.35rem;flex-wrap:wrap">
        {actions.map((a, i) => {
          const styles = a.variant === "primary"
            ? "background:#16a34a;color:#fff;border:none"
            : a.variant === "danger"
            ? "background:#fff;color:#dc2626;border:1px solid #fecaca"
            : "background:#fff;color:#6b7280;border:1px solid #e5e7eb";
          return (
            <button
              key={i}
              disabled={busy}
              onClick={a.onClick}
              style={`${styles};border-radius:0.5rem;padding:0.4rem 0.7rem;font-size:0.78rem;font-weight:600;cursor:${busy ? "wait" : "pointer"}`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegacyTab() {
  return (
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:1rem;padding:1.5rem;text-align:center">
      <p style="font-size:0.95rem;font-weight:600;color:#1f2937;margin-bottom:0.25rem">
        📂 Panel legacy (localStorage)
      </p>
      <p style="color:#6b7280;font-size:0.85rem;margin-bottom:1rem">
        Acceso a los pedidos creados antes de Supabase.
        Contraseña: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:0.75rem">MAfinomax</code>.
      </p>
      <a href="/admin?legacy=1" style="display:inline-block;background:#377DEC;color:#fff;padding:0.55rem 1.2rem;border-radius:0.5rem;font-weight:600;text-decoration:none;font-size:0.85rem">
        Abrir panel legacy
      </a>
    </div>
  );
}

// ============================================================
// HorariosPanel
// ============================================================
const DIAS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DIA_LABELS = { monday:"Lun", tuesday:"Mar", wednesday:"Mié", thursday:"Jue", friday:"Vie", saturday:"Sáb", sunday:"Dom" };

function HorariosPanel() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [err, setErr] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const sb = useMemo(() => getSupabase(), []);

  const fetchSchedules = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("schedules").select("*").order("service_name");
    if (error) { setErr(error.message); setLoading(false); return; }
    setSchedules(data || []);
    setLoading(false);
  }, [sb]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // Realtime
  useEffect(() => {
    if (!sb) return;
    const ch = sb.channel("schedules-admin")
      .on("postgres_changes", { event: "*", schema: "mandados", table: "schedules" }, fetchSchedules)
      .subscribe();
    return () => { try { ch.unsubscribe(); } catch {} };
  }, [sb, fetchSchedules]);

  const update = (id, patch) => {
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const toggleDay = (id, day) => {
    const s = schedules.find((s) => s.id === id);
    if (!s) return;
    const days = Array.isArray(s.days_open) ? [...s.days_open] : [];
    const idx = days.indexOf(day);
    if (idx >= 0) days.splice(idx, 1); else days.push(day);
    update(id, { days_open: days });
  };

  const save = async (schedule) => {
    if (!sb) return;
    setSaving(schedule.id);
    setErr(null);
    const { error } = await sb.from("schedules").update({
      is_open: schedule.is_open,
      open_time: schedule.open_time,
      close_time: schedule.close_time,
      days_open: schedule.days_open,
      updated_at: new Date().toISOString(),
    }).eq("id", schedule.id);
    setSaving(null);
    if (error) { setErr(error.message); return; }
    setSuccessId(schedule.id);
    setTimeout(() => setSuccessId(null), 2000);
  };

  if (loading) return <p style="color:#6b7280;font-size:0.875rem;padding:1rem">Cargando horarios...</p>;

  return (
    <div>
      <p style="font-size:0.8rem;color:#6b7280;margin-bottom:1rem">
        Configurá los horarios de cada servicio. El servicio "24 Horas" siempre está abierto.
      </p>
      {err && <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:0.6rem 0.75rem;border-radius:0.5rem;margin-bottom:0.75rem;font-size:0.85rem">⚠ {err}</div>}
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        {schedules.map((s) => {
          const is24 = s.service_slug === "24horas";
          const daysArr = Array.isArray(s.days_open) ? s.days_open : [];
          return (
            <div key={s.id} style={`background:#fff;border:1px solid ${is24 ? "#86efac" : "#e5e7eb"};border-radius:0.875rem;padding:1rem;${is24 ? "background:#f0fdf4" : ""}`}>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem">
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <span style="font-weight:700;color:#1f2937;font-size:0.9rem">{s.service_name}</span>
                  {is24 && <span style="background:#dcfce7;color:#166534;font-size:0.65rem;font-weight:700;padding:0.15rem 0.45rem;border-radius:9999px">Abierto 24hs</span>}
                </div>
                {!is24 && (
                  <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer">
                    <div
                      onClick={() => update(s.id, { is_open: !s.is_open })}
                      style={`width:40px;height:22px;border-radius:11px;cursor:pointer;transition:background 0.2s;background:${s.is_open ? "#16a34a" : "#d1d5db"};position:relative`}
                    >
                      <div style={`width:18px;height:18px;border-radius:9px;background:#fff;position:absolute;top:2px;transition:left 0.2s;left:${s.is_open ? "20px" : "2px"};box-shadow:0 1px 3px rgba(0,0,0,0.2)`} />
                    </div>
                    <span style="font-size:0.8rem;color:#374151;font-weight:600">{s.is_open ? "Abierto" : "Cerrado"}</span>
                  </label>
                )}
              </div>

              {!is24 && (
                <>
                  <div style="display:flex;gap:0.5rem;margin-bottom:0.6rem;flex-wrap:wrap">
                    <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.78rem;color:#374151">
                      Abre:
                      <input type="time" value={s.open_time} onChange={(e) => update(s.id, { open_time: e.currentTarget.value })}
                        style="border:1px solid #d1d5db;border-radius:0.4rem;padding:0.25rem 0.4rem;font-size:0.8rem;outline:none" />
                    </label>
                    <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.78rem;color:#374151">
                      Cierra:
                      <input type="time" value={s.close_time} onChange={(e) => update(s.id, { close_time: e.currentTarget.value })}
                        style="border:1px solid #d1d5db;border-radius:0.4rem;padding:0.25rem 0.4rem;font-size:0.8rem;outline:none" />
                    </label>
                  </div>
                  <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.65rem">
                    {DIAS.map((d) => {
                      const active = daysArr.includes(d);
                      return (
                        <button key={d} type="button" onClick={() => toggleDay(s.id, d)}
                          style={`font-size:0.7rem;font-weight:600;padding:0.25rem 0.45rem;border-radius:0.35rem;cursor:pointer;border:1px solid;transition:all 0.15s;${active ? "background:#377DEC;color:#fff;border-color:#377DEC" : "background:#fff;color:#6b7280;border-color:#d1d5db"}`}>
                          {DIA_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style="display:flex;align-items:center;gap:0.5rem">
                <button
                  onClick={() => save(s)}
                  disabled={saving === s.id}
                  style={`background:${saving === s.id ? "#cbd5e1" : "#377DEC"};color:#fff;border:none;border-radius:0.5rem;padding:0.4rem 0.85rem;font-size:0.78rem;font-weight:600;cursor:${saving === s.id ? "wait" : "pointer"}`}
                >
                  {saving === s.id ? "Guardando..." : "Guardar"}
                </button>
                {successId === s.id && (
                  <span style="font-size:0.75rem;color:#16a34a;font-weight:600">✓ Guardado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ResumenDiario
// ============================================================
function ResumenDiario() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("hoy"); // "hoy" | "ayer" | "semana" | "mes" | "personalizado"
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const sb = useMemo(() => getSupabase(), []);

  const fetchForRange = useCallback(async (rangeStart, rangeEnd) => {
    if (!sb) return;
    setLoading(true);
    const { data } = await sb.from("orders")
      .select("id, status, total_amount, driver_commission, services_count, payment_method, payment_status, payment_provider, created_at, customer_name")
      .gte("created_at", rangeStart.toISOString())
      .lte("created_at", rangeEnd.toISOString())
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    const now = new Date();
    let start, end;
    switch (dateFilter) {
      case "ayer": {
        const ayer = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        start = ayer;
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case "semana": {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      }
      case "mes": {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      }
      case "personalizado": {
        if (customFrom && customTo) {
          start = new Date(customFrom);
          end = new Date(customTo);
          end.setDate(end.getDate() + 1);
        } else {
          setLoading(false);
          return;
        }
        break;
      }
      default: { // "hoy"
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      }
    }
    fetchForRange(start, end);
  }, [dateFilter, customFrom, customTo, fetchForRange]);

  if (loading) return <p style="color:#6b7280;font-size:0.875rem;padding:1rem">Cargando resumen...</p>;

  const totalRevenue = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const totalCommissions = orders.reduce((s, o) => s + (Number(o.driver_commission) || 0), 0);
  const delivered = orders.filter((o) => o.status === "entregado").length;
  const pending = orders.filter((o) => !["entregado","cancelado"].includes(o.status)).length;
  const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");

  return (
    <div>
      <p style="font-size:0.8rem;color:#6b7280;margin-bottom:0.5rem">
        Resumen de pedidos por período.
      </p>

      {/* Filtro de fechas */}
      <div style="display:flex;gap:0.35rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">
        {[
          { id: "hoy", label: "Hoy" },
          { id: "ayer", label: "Ayer" },
          { id: "semana", label: "7 días" },
          { id: "mes", label: "Este mes" },
          { id: "personalizado", label: "Personalizado" },
        ].map((f) => {
          const active = dateFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              style={`font-size:0.75rem;padding:0.3rem 0.65rem;border-radius:0.4rem;border:1px solid;cursor:pointer;${active ? "background:#377DEC;color:#fff;border-color:#377DEC" : "background:#fff;color:#4b5563;border-color:#e5e7eb"}`}
            >
              {f.label}
            </button>
          );
        })}
        {dateFilter === "personalizado" && (
          <div style="display:flex;gap:0.35rem;align-items:center;flex-wrap:wrap">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.currentTarget.value)}
              style="font-size:0.75rem;padding:0.25rem 0.4rem;border:1px solid #d1d5db;border-radius:0.35rem;outline:none;max-width:130px"
            />
            <span style="font-size:0.7rem;color:#6b7280">a</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.currentTarget.value)}
              style="font-size:0.75rem;padding:0.25rem 0.4rem;border:1px solid #d1d5db;border-radius:0.35rem;outline:none;max-width:130px"
            />
          </div>
        )}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1.25rem">
        {[
          { label: "Pedidos hoy", value: orders.length, color: "#377DEC" },
          { label: "Entregados", value: delivered, color: "#16a34a" },
          { label: "Pendientes", value: pending, color: "#f59e0b" },
          { label: "Facturado", value: fmt(totalRevenue), color: "#1f2937" },
          { label: "Comisiones", value: fmt(totalCommissions), color: "#7c3aed" },
          { label: "Neto", value: fmt(totalRevenue - totalCommissions), color: "#0ea5e9" },
        ].map((s) => (
          <div key={s.label} style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.75rem;text-align:center">
            <p style={`font-size:1.25rem;font-weight:800;color:${s.color};margin:0`}>{s.value}</p>
            <p style="font-size:0.72rem;color:#6b7280;margin:0.15rem 0 0">{s.label}</p>
          </div>
        ))}
      </div>

      <h3 style="font-size:0.88rem;font-weight:700;color:#374151;margin:0 0 0.6rem">Pedidos del día</h3>
      {orders.length === 0 ? (
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:1.25rem;text-align:center;color:#9ca3af;font-size:0.85rem">
          Sin pedidos hoy.
        </div>
      ) : (
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          {orders.map((o) => (
            <div key={o.id} style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.65rem 0.875rem;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap">
              <div>
                <p style="font-size:0.82rem;font-weight:600;color:#1f2937;margin:0">{o.customer_name || "Sin nombre"}</p>
                <p style="font-size:0.7rem;color:#9ca3af;margin:0">
                  {new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {o.services_count || "?"} servicio{(o.services_count || 1) > 1 ? "s" : ""}
                </p>
              </div>
              <div style="text-align:right">
                <p style="font-size:0.88rem;font-weight:700;color:#1f2937;margin:0">{fmt(o.total_amount || 0)}</p>
                <p style="font-size:0.68rem;color:#7c3aed;margin:0">Comisión: {fmt(o.driver_commission || 0)}</p>
                {o.payment_provider && (
                  <p style="font-size:0.65rem;color:#6b7280;margin:0">
                    {o.payment_provider === "stripe" ? "💳 Tarjeta" : o.payment_provider === "mercadopago" ? "🏦 MP" : o.payment_provider}
                    {o.payment_status === "pagado" ? " ✓" : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
