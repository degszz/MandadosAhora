import { useEffect, useState, useRef, useCallback, useMemo } from "preact/hooks";
import { getSupabase, getMyProfile, signOut } from "../scripts/supabase.js";

/**
 * Panel del repartidor (también reutilizado embebido en /admin).
 *
 * Props:
 *  - mode: "repartidor" | "admin"
 *  - todayOnly: boolean (default true para repartidor, false para admin)
 */
export default function RepartidorPanel({ mode = "repartidor", todayOnly = true }) {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(mode === "admin" ? "todos" : "disponibles");
  const [chatOrderId, setChatOrderId] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const sb = useMemo(() => getSupabase(), []);

  // ---------- bootstrap ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sb) {
        setError("Supabase no configurado. Revisá el .env.");
        setLoading(false);
        return;
      }
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        window.location.replace("/repartidor");
        return;
      }
      const p = await getMyProfile();
      if (cancelled) return;
      if (!p) {
        setError("No se encontró tu perfil.");
        setLoading(false);
        return;
      }
      if (mode === "repartidor" && !p.verified) {
        window.location.replace("/repartidor/espera");
        return;
      }
      if (mode === "admin" && p.role !== "admin") {
        setError("Acceso denegado. Necesitás permisos de admin.");
        setLoading(false);
        return;
      }
      setProfile(p);
      setIsAvailable(p.is_available !== false);
      await fetchOrders();
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sb, mode]);

  // ---------- fetch orders ----------
  const fetchOrders = useCallback(async () => {
    if (!sb) return;
    let q = sb.from("orders").select("*").order("created_at", { ascending: false });
    if (todayOnly) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      q = q.gte("created_at", since.toISOString());
    }
    const { data, error } = await q;
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }
    setOrders(data || []);
  }, [sb, todayOnly]);

  // ---------- realtime orders ----------
  useEffect(() => {
    if (!sb || !profile) return;
    const ch = sb
      .channel("orders-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "mandados", table: "orders" },
        () => { fetchOrders(); }
      )
      .subscribe();
    return () => { try { ch.unsubscribe(); } catch {} };
  }, [sb, profile, fetchOrders]);

  // ---------- acciones ----------
  const claimOrder = async (orderId) => {
    if (!sb) return;
    setBusyOrderId(orderId);
    setError(null);
    try {
      const { error } = await sb.rpc("claim_order", { p_order_id: orderId });
      if (error) throw error;
      await fetchOrders();
    } catch (e) {
      setError(e.message || "No se pudo tomar el pedido");
    } finally {
      setBusyOrderId(null);
    }
  };

  const setOrderStatus = async (orderId, status) => {
    if (!sb) return;
    setBusyOrderId(orderId);
    setError(null);
    try {
      const { error } = await sb.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;
      await fetchOrders();
    } catch (e) {
      setError(e.message || "No se pudo cambiar el estado");
    } finally {
      setBusyOrderId(null);
    }
  };

  const assignRepartidor = async (orderId, repartidorId) => {
    if (!sb) return;
    setBusyOrderId(orderId);
    try {
      const patch = repartidorId
        ? { repartidor_id: repartidorId, status: "confirmado" }
        : { repartidor_id: null };
      const { error } = await sb.from("orders").update(patch).eq("id", orderId);
      if (error) throw error;
      await fetchOrders();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyOrderId(null);
    }
  };

  const toggleAvailability = async () => {
    if (!sb || !profile) return;
    setTogglingAvail(true);
    const newVal = !isAvailable;
    const { error } = await sb.from("profiles").update({ is_available: newVal }).eq("id", profile.id);
    if (!error) setIsAvailable(newVal);
    setTogglingAvail(false);
  };

  const logout = async () => {
    await signOut();
    window.location.replace("/repartidor");
  };

  // ---------- filtros ----------
  const filteredOrders = useMemo(() => {
    if (filter === "todos") return orders;
    if (filter === "disponibles") return orders.filter((o) => !o.repartidor_id);
    if (filter === "mios") return orders.filter((o) => o.repartidor_id === profile?.id);
    if (filter === "en_curso") return orders.filter((o) =>
      ["confirmado", "en_camino"].includes(o.status) &&
      (mode === "admin" || o.repartidor_id === profile?.id)
    );
    if (filter === "entregados") return orders.filter((o) => o.status === "entregado");
    if (filter === "cancelados") return orders.filter((o) => o.status === "cancelado");
    return orders;
  }, [orders, filter, profile, mode]);

  // ---------- UI helpers ----------
  if (loading) return <PanelLoading />;
  if (error && !profile) return <PanelError error={error} onRetry={() => location.reload()} />;

  return (
    <div style="width:100%">
      {/* Header */}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div>
          <h1 style="font-size:1.5rem;font-weight:700;color:#1f2937">
            {mode === "admin" ? "Panel de pedidos (admin)" : "Mis pedidos"}
          </h1>
          <p style="font-size:0.8rem;color:#6b7280;margin-top:0.15rem">
            {profile?.full_name || profile?.email}
            {mode === "admin" ? " · admin" : " · repartidor"}
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">
        {mode === "repartidor" && (
          <button
            onClick={toggleAvailability}
            disabled={togglingAvail}
            style={`display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;font-weight:600;padding:0.4rem 0.8rem;border-radius:0.5rem;cursor:${togglingAvail ? "wait" : "pointer"};border:1.5px solid ${isAvailable ? "#bbf7d0" : "#fecaca"};background:${isAvailable ? "#f0fdf4" : "#fef2f2"};color:${isAvailable ? "#166534" : "#991b1b"};transition:all .2s;opacity:${togglingAvail ? "0.5" : "1"}`}
          >
            <span style={`width:8px;height:8px;border-radius:50%;background:${isAvailable ? "#22c55e" : "#ef4444"}`}></span>
            {isAvailable ? "Disponible" : "No disponible"}
          </button>
        )}
        <button
          onClick={logout}
          style="font-size:0.8rem;color:#6b7280;background:#fff;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.4rem 0.75rem;cursor:pointer"
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#fca5a5"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; }}
        >
          Cerrar sesión
        </button>
        </div>
      </div>

      {error && (
        <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:0.6rem 0.75rem;border-radius:0.5rem;margin-bottom:0.75rem;font-size:0.85rem">
          ⚠️ {error}
        </div>
      )}

      {/* Filtros */}
      <div style="display:flex;gap:0.4rem;margin-bottom:1rem;flex-wrap:wrap">
        {filterDefs(mode).map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={`font-size:0.8rem;padding:0.35rem 0.75rem;border-radius:9999px;border:1px solid;cursor:pointer;transition:all 0.15s;${active ? "background:#377DEC;color:#fff;border-color:#377DEC" : "background:#fff;color:#4b5563;border-color:#e5e7eb"}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {filter === "ganancias" ? (
        <GananciasPanel profile={profile} orders={orders} mode={mode} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          {filteredOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              profile={profile}
              mode={mode}
              busy={busyOrderId === o.id}
              onClaim={() => claimOrder(o.id)}
              onSetStatus={(s) => setOrderStatus(o.id, s)}
              onOpenChat={() => setChatOrderId(o.id)}
              onAssign={(rid) => assignRepartidor(o.id, rid)}
            />
          ))}
        </div>
      )}

      {chatOrderId && (
        <ChatModal
          orderId={chatOrderId}
          profile={profile}
          onClose={() => setChatOrderId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// OrderCard
// ============================================================
function OrderCard({ order, profile, mode, busy, onClaim, onSetStatus, onOpenChat, onAssign }) {
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);

  const isMine = order.repartidor_id === profile?.id;
  const isUnclaimed = !order.repartidor_id;
  const isAdmin = mode === "admin";
  const canChat = isMine || isAdmin;
  const canClaim = isUnclaimed && order.status !== "cancelado" && order.status !== "entregado";

  const handleConfirmDelivery = () => {
    if (order.delivery_code) {
      setShowCodeInput(true);
      setCodeError("");
      setCodeInput("");
    } else {
      // No code set — confirm directly
      onSetStatus("entregado");
    }
  };

  const submitCode = () => {
    if (codeInput.trim() === String(order.delivery_code).trim()) {
      setCodeError("");
      setDeliverySuccess(true);
      const commission = Number(order.driver_commission || 0);
      setTimeout(() => onSetStatus("entregado"), 1200);
    } else {
      setCodeError("Código incorrecto — pedíselo al cliente");
    }
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const fecha = new Date(order.created_at);
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const mapsUrl = order.address
    ? (order.address_lat && order.address_lng
        ? `https://www.google.com/maps/dir/?api=1&destination=${order.address_lat},${order.address_lng}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}&travelmode=driving`)
    : null;

  return (
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:1rem;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
      {/* Top row */}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.6rem">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
          <StatusBadge status={order.status} />
          <PaymentBadge method={order.payment_method} status={order.payment_status} provider={order.payment_provider} />
          {isMine && <Tag bg="#EBF3FF" color="#1e40af" label="Asignado a mí" />}
          {isUnclaimed && <Tag bg="#fef3c7" color="#92400e" label="Disponible" />}
        </div>
        <span style="font-size:0.75rem;color:#9ca3af;font-variant-numeric:tabular-nums">
          🕒 {hora}
        </span>
      </div>

      {/* Cliente */}
      {(order.customer_name || order.customer_email) && (
        <div style="font-size:0.85rem;color:#374151;margin-bottom:0.5rem">
          <span style="color:#6b7280">👤 </span>
          <b>{order.customer_name || "Sin nombre"}</b>
          {order.customer_email && <span style="color:#6b7280"> · {order.customer_email}</span>}
        </div>
      )}

      {/* Items */}
      <div style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.6rem">
        {items.length === 0 ? (
          <p style="font-size:0.8rem;color:#9ca3af;font-style:italic">Sin items detallados.</p>
        ) : items.map((it, i) => (
          <div key={i} style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:0.5rem;padding:0.5rem 0.65rem">
            <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center;margin-bottom:0.2rem">
              <span style="font-weight:600;color:#1f2937;font-size:0.85rem">
                {servicioEmoji(it.servicio)} {it.servicio || "Servicio"}
              </span>
              {it.negocio && (
                <span style="font-size:0.72rem;color:#6b7280">🏬 {it.negocio}</span>
              )}
            </div>
            {it.descripcion && (
              <p style="font-size:0.78rem;color:#4b5563;white-space:pre-wrap;margin:0">
                {it.descripcion}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Pricing */}
      {(order.total_amount || order.services_count) && (
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.7rem;margin-bottom:0.6rem;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:0.78rem;color:#6b7280">
            {order.services_count || "?"} servicio{(order.services_count || 1) > 1 ? "s" : ""}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.1rem">
            <span style="font-size:0.85rem;font-weight:700;color:#1f2937">
              ${Number(order.total_amount || 0).toLocaleString("es-AR")}
            </span>
            <span style="font-size:0.68rem;color:#16a34a;font-weight:600">
              Tu ganancia: ${Number(order.driver_commission || 0).toLocaleString("es-AR")}
            </span>
          </div>
        </div>
      )}

      {/* Audio del pedido */}
      {order.audio_url && (
        <div style="background:#f0f4ff;border:1px solid #bfd7ff;border-radius:0.5rem;padding:0.55rem 0.7rem;margin-bottom:0.6rem;display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:1.1rem;flex-shrink:0">🎙️</span>
          <div style="flex:1;min-width:0">
            <p style="font-size:0.72rem;font-weight:600;color:#1e40af;margin:0 0 0.25rem">Audio del cliente</p>
            <audio src={order.audio_url} controls preload="metadata" style="width:100%;height:32px" />
          </div>
        </div>
      )}

      {/* Dirección */}
      {order.address && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener"
          style="display:flex;align-items:center;gap:0.5rem;background:#EBF3FF;color:#1e40af;padding:0.55rem 0.7rem;border-radius:0.5rem;font-size:0.82rem;font-weight:500;text-decoration:none;margin-bottom:0.75rem"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>
            <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
          </svg>
          <span style="flex:1">{order.address}</span>
          <span style="font-size:0.7rem;opacity:0.7">Navegar con Maps →</span>
        </a>
      )}

      {/* Acciones */}
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        {canClaim && (
          <button
            disabled={busy}
            onClick={onClaim}
            style="flex:1;min-width:120px;background:#377DEC;color:#fff;border:none;border-radius:0.5rem;padding:0.6rem 0.75rem;font-weight:600;font-size:0.85rem;cursor:pointer;opacity:1"
            onMouseEnter={(e) => !busy && (e.currentTarget.style.background = "#2563c0")}
            onMouseLeave={(e) => !busy && (e.currentTarget.style.background = "#377DEC")}
          >
            {busy ? "Tomando..." : "🚀 Tomar pedido"}
          </button>
        )}
        {isMine && !["entregado", "cancelado"].includes(order.status) && (
          <>
            {order.status === "confirmado" && (
              <button
                disabled={busy}
                onClick={() => onSetStatus("en_camino")}
                style="flex:1;min-width:120px;background:#0ea5e9;color:#fff;border:none;border-radius:0.5rem;padding:0.55rem 0.75rem;font-weight:600;font-size:0.82rem;cursor:pointer"
              >
                🛵 En camino
              </button>
            )}
            {!showCodeInput && !deliverySuccess && (
              <button
                disabled={busy}
                onClick={handleConfirmDelivery}
                style="flex:1;min-width:120px;background:#16a34a;color:#fff;border:none;border-radius:0.5rem;padding:0.55rem 0.75rem;font-weight:600;font-size:0.82rem;cursor:pointer"
              >
                ✓ Confirmar entrega
              </button>
            )}
          </>
        )}
        {canChat && (
          <button
            onClick={onOpenChat}
            style="background:#fff;color:#377DEC;border:1px solid #BFD7FF;border-radius:0.5rem;padding:0.55rem 0.85rem;font-weight:600;font-size:0.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem"
          >
            💬 Chat
          </button>
        )}
        {isAdmin && (
          <AdminMenu
            order={order}
            busy={busy}
            onSetStatus={onSetStatus}
            onAssign={onAssign}
          />
        )}
      </div>

      {/* Delivery code input */}
      {showCodeInput && !deliverySuccess && isMine && (
        <div style="margin-top:0.5rem;background:#f9fafb;border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.75rem">
          <p style="font-size:0.78rem;font-weight:600;color:#1f2937;margin:0 0 0.4rem">
            Pedile el código al cliente
          </p>
          <div style="display:flex;gap:0.4rem">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={codeInput}
              onInput={(e) => { setCodeInput(e.currentTarget.value); setCodeError(""); }}
              style="flex:1;padding:0.5rem 0.65rem;border:1px solid #d1d5db;border-radius:0.5rem;font-size:1rem;font-weight:700;letter-spacing:0.15em;font-family:monospace;outline:none;text-align:center"
            />
            <button
              onClick={submitCode}
              disabled={codeInput.length < 4}
              style={`padding:0.5rem 0.85rem;border-radius:0.5rem;border:none;font-weight:600;font-size:0.82rem;cursor:${codeInput.length < 4 ? "not-allowed" : "pointer"};background:${codeInput.length < 4 ? "#cbd5e1" : "#16a34a"};color:#fff`}
            >
              Validar
            </button>
          </div>
          {codeError && (
            <p style="font-size:0.75rem;color:#b91c1c;margin:0.35rem 0 0">⚠ {codeError}</p>
          )}
          <button
            onClick={() => { setShowCodeInput(false); setCodeError(""); }}
            style="font-size:0.72rem;color:#9ca3af;background:none;border:none;cursor:pointer;margin-top:0.35rem;padding:0"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Delivery success banner */}
      {deliverySuccess && (
        <div style="margin-top:0.5rem;background:#dcfce7;border:1px solid #86efac;border-radius:0.6rem;padding:0.65rem;text-align:center">
          <p style="font-size:0.88rem;font-weight:700;color:#166534;margin:0">Entrega confirmada ✅</p>
          <p style="font-size:0.78rem;color:#166534;margin:0.15rem 0 0">
            Tu ganancia: ${Number(order.driver_commission || 0).toLocaleString("es-AR")}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AdminMenu: dropdown para asignar/cambiar estado
// ============================================================
function AdminMenu({ order, busy, onSetStatus, onAssign }) {
  const [open, setOpen] = useState(false);
  const [reps, setReps] = useState([]);
  const sb = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!open || !sb) return;
    (async () => {
      const { data } = await sb
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "repartidor")
        .eq("verified", true);
      setReps(data || []);
    })();
  }, [open, sb]);

  return (
    <div style="position:relative">
      <button
        onClick={() => setOpen(!open)}
        style="background:#fff;color:#374151;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.55rem 0.65rem;font-size:0.82rem;cursor:pointer"
      >
        ⚙️ Admin
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style="position:fixed;inset:0;z-index:50"
          />
          <div style="position:absolute;right:0;top:100%;margin-top:0.25rem;background:#fff;border:1px solid #e5e7eb;border-radius:0.5rem;box-shadow:0 10px 25px -5px rgba(0,0,0,0.15);padding:0.4rem;min-width:200px;z-index:51">
            <div style="font-size:0.65rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;padding:0.35rem 0.5rem">
              Estado
            </div>
            {["pendiente", "confirmado", "en_camino", "entregado", "cancelado"].map((s) => (
              <button
                key={s}
                disabled={busy || order.status === s}
                onClick={() => { onSetStatus(s); setOpen(false); }}
                style={`display:block;width:100%;text-align:left;font-size:0.8rem;padding:0.4rem 0.5rem;border-radius:0.35rem;border:none;background:transparent;cursor:${order.status === s ? "default" : "pointer"};color:${order.status === s ? "#9ca3af" : "#374151"}`}
                onMouseEnter={(e) => order.status !== s && (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {order.status === s ? "● " : ""}{s.replace("_", " ")}
              </button>
            ))}
            <div style="border-top:1px solid #f3f4f6;margin:0.3rem 0"></div>
            <div style="font-size:0.65rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;padding:0.35rem 0.5rem">
              Asignar repartidor
            </div>
            {reps.length === 0 && (
              <div style="font-size:0.75rem;color:#9ca3af;padding:0.35rem 0.5rem">Sin repartidores verificados.</div>
            )}
            {reps.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => { onAssign(r.id); setOpen(false); }}
                style={`display:block;width:100%;text-align:left;font-size:0.8rem;padding:0.4rem 0.5rem;border-radius:0.35rem;border:none;background:${order.repartidor_id === r.id ? "#EBF3FF" : "transparent"};cursor:pointer;color:#374151`}
                onMouseEnter={(e) => order.repartidor_id !== r.id && (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={(e) => order.repartidor_id !== r.id && (e.currentTarget.style.background = "transparent")}
              >
                {order.repartidor_id === r.id ? "● " : ""}{r.full_name || r.email}
              </button>
            ))}
            {order.repartidor_id && (
              <button
                disabled={busy}
                onClick={() => { onAssign(null); setOpen(false); }}
                style="display:block;width:100%;text-align:left;font-size:0.78rem;padding:0.4rem 0.5rem;border-radius:0.35rem;border:none;background:transparent;cursor:pointer;color:#ef4444"
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                ↺ Quitar asignación
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// ChatModal
// ============================================================
function ChatModal({ orderId, profile, onClose }) {
  const [messages, setMessages] = useState([]);
  const [senderProfiles, setSenderProfiles] = useState({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState(null);
  const scrollRef = useRef(null);
  const sb = useMemo(() => getSupabase(), []);

  // fetch + realtime
  useEffect(() => {
    if (!sb || !orderId) return;
    let cancelled = false;
    (async () => {
      const [{ data: msgs, error: e1 }, { data: ord, error: e2 }] = await Promise.all([
        sb.from("messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
        sb.from("orders").select("*").eq("id", orderId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (e1) setErr(e1.message);
      if (e2) setErr(e2.message);
      setMessages(msgs || []);
      setOrder(ord || null);

      // Fetch sender profiles for all unique sender_ids
      const senderIds = [...new Set((msgs || []).map((m) => m.sender_id).filter(Boolean))];
      if (senderIds.length > 0) {
        const { data: profiles } = await sb
          .from("profiles")
          .select("id, full_name, avatar_url, role")
          .in("id", senderIds);
        if (!cancelled && profiles) {
          const map = {};
          profiles.forEach((p) => { map[p.id] = p; });
          setSenderProfiles(map);
        }
      }
    })();

    const ch = sb
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "mandados", table: "messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Fetch profile for new sender if not already cached
          if (msg.sender_id && !senderProfiles[msg.sender_id]) {
            sb.from("profiles")
              .select("id, full_name, avatar_url, role")
              .eq("id", msg.sender_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) setSenderProfiles((prev) => ({ ...prev, [data.id]: data }));
              });
          }
        }
      )
      .subscribe();

    return () => { cancelled = true; try { ch.unsubscribe(); } catch {} };
  }, [sb, orderId]);

  // autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Escape to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async (e) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setErr(null);
    try {
      const { error } = await sb.from("messages").insert({
        order_id: orderId,
        sender_id: profile.id,
        sender_role: profile.role,
        sender_name: profile.full_name || profile.email,
        content,
      });
      if (error) throw error;
      setInput("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1200"
      />
      <div
        role="dialog"
        aria-modal="true"
        style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1201;width:calc(100% - 1.5rem);max-width:28rem;height:80vh;max-height:560px;background:#F3F5F6;border-radius:1rem;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4)"
      >
        {/* Header */}
        <div style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0.75rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
          <div style="min-width:0">
            <p style="font-size:0.85rem;font-weight:700;color:#1f2937;margin:0">Chat del pedido</p>
            <p style="font-size:0.7rem;color:#9ca3af;margin:0;font-family:monospace">
              {orderId.slice(0, 8)}…
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style="padding:0.4rem;border-radius:0.5rem;background:transparent;border:none;cursor:pointer;color:#6b7280"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} style="flex:1;overflow-y:auto;padding:0.85rem;display:flex;flex-direction:column;gap:0.4rem">
          {messages.length === 0 && (
            <p style="text-align:center;color:#9ca3af;font-size:0.85rem;padding:2rem 1rem">
              Sin mensajes todavía. Empezá la conversación.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === profile.id;
            const isCliente = m.sender_role === "cliente";
            const sp = m.sender_id ? senderProfiles[m.sender_id] : null;
            const senderName = isCliente
              ? (m.sender_name || "Cliente")
              : (sp?.full_name || (m.sender_role === "admin" ? "Admin" : "Repartidor"));
            const senderAvatar = sp?.avatar_url;
            const roleIcon = isCliente ? "👤 " : m.sender_role === "admin" ? "🛡 " : "🛵 ";
            const bubbleBg = isCliente ? "background:#f0fdf4;color:#1f2937;border:1px solid #bbf7d0;border-bottom-left-radius:0.25rem" : "";
            const avatarBg = isCliente ? "background:#dcfce7;color:#16a34a" : "background:#EBF3FF;color:#377DEC";
            return (
              <div key={m.id} style={`display:flex;gap:0.4rem;${mine ? "justify-content:flex-end" : "justify-content:flex-start"}`}>
                {!mine && (
                  senderAvatar
                    ? <img src={senderAvatar} alt="" referrerpolicy="no-referrer" style="width:28px;height:28px;border-radius:9999px;object-fit:cover;flex-shrink:0;margin-top:0.15rem" />
                    : <div style={`width:28px;height:28px;border-radius:9999px;${avatarBg};font-weight:700;font-size:0.7rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.15rem`}>{senderName.slice(0, 1).toUpperCase()}</div>
                )}
                <div style={`max-width:70%;padding:0.5rem 0.75rem;border-radius:0.875rem;${mine ? "background:#377DEC;color:#fff;border-bottom-right-radius:0.25rem" : isCliente ? bubbleBg : "background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:0.25rem"}`}>
                  <p style={`font-size:0.65rem;font-weight:600;letter-spacing:0.02em;margin:0 0 0.2rem;${mine ? "color:rgba(255,255,255,0.7)" : isCliente ? "color:#16a34a" : "color:#377DEC"}`}>
                    {roleIcon}{senderName}
                  </p>
                  <p style="font-size:0.88rem;line-height:1.35;margin:0;white-space:pre-wrap;word-break:break-word">
                    {m.content}
                  </p>
                  <p style={`font-size:0.65rem;margin:0.15rem 0 0;text-align:right;${mine ? "color:rgba(255,255,255,0.7)" : "color:#9ca3af"}`}>
                    {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {mine && (
                  senderAvatar
                    ? <img src={senderAvatar} alt="" referrerpolicy="no-referrer" style="width:28px;height:28px;border-radius:9999px;object-fit:cover;flex-shrink:0;margin-top:0.15rem" />
                    : <div style="width:28px;height:28px;border-radius:9999px;background:#377DEC;color:#fff;font-weight:700;font-size:0.7rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.15rem">{senderName.slice(0, 1).toUpperCase()}</div>
                )}
              </div>
            );
          })}
        </div>

        {err && (
          <p style="font-size:0.75rem;color:#b91c1c;background:#fef2f2;border-top:1px solid #fecaca;padding:0.4rem 0.75rem;margin:0">
            ⚠️ {err}
          </p>
        )}

        {/* Input */}
        {order && !(order.repartidor_id === profile.id || profile.role === "admin") ? (
          <div style="padding:0.7rem;background:#fff;border-top:1px solid #e5e7eb;font-size:0.78rem;color:#9ca3af;text-align:center">
            Tenés que tomar el pedido antes de poder chatear.
          </div>
        ) : (
          <form onSubmit={send} style="padding:0.55rem;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:0.4rem">
            <input
              value={input}
              onInput={(e) => setInput(e.currentTarget.value)}
              placeholder="Escribí un mensaje..."
              disabled={sending}
              maxLength={2000}
              style="flex:1;padding:0.55rem 0.75rem;border:1px solid #e5e7eb;border-radius:9999px;outline:none;font-size:0.88rem;background:#f9fafb"
              onFocus={(e) => { e.currentTarget.style.borderColor = "#377DEC"; e.currentTarget.style.background = "#fff"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Enviar"
              style={`width:40px;height:40px;border-radius:9999px;border:none;cursor:${!input.trim() || sending ? "not-allowed" : "pointer"};background:${!input.trim() || sending ? "#cbd5e1" : "#377DEC"};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 14l11 -11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -8l-8 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/>
              </svg>
            </button>
          </form>
        )}
      </div>
    </>
  );
}

// ============================================================
// utils & sub-components
// ============================================================
function filterDefs(mode) {
  if (mode === "admin") {
    return [
      { id: "todos",       label: "Todos" },
      { id: "disponibles", label: "Disponibles" },
      { id: "en_curso",    label: "En curso" },
      { id: "entregados",  label: "Entregados" },
      { id: "cancelados",  label: "Cancelados" },
    ];
  }
  return [
    { id: "disponibles", label: "Disponibles" },
    { id: "mios",        label: "Míos" },
    { id: "en_curso",    label: "En curso" },
    { id: "entregados",  label: "Entregados" },
    { id: "ganancias",   label: "💰 Ganancias" },
  ];
}

function StatusBadge({ status }) {
  const colors = {
    pendiente:  { bg: "#fef3c7", fg: "#92400e", label: "Pendiente" },
    confirmado: { bg: "#dbeafe", fg: "#1e40af", label: "Confirmado" },
    en_camino:  { bg: "#cffafe", fg: "#155e75", label: "En camino" },
    entregado:  { bg: "#dcfce7", fg: "#166534", label: "Entregado" },
    cancelado:  { bg: "#fee2e2", fg: "#991b1b", label: "Cancelado" },
  };
  const c = colors[status] || { bg: "#f3f4f6", fg: "#374151", label: status };
  return <Tag bg={c.bg} color={c.fg} label={c.label} />;
}

function PaymentBadge({ method, status, provider }) {
  const paid = status === "pagado";

  // Si hay payment_provider, usar ese para el badge
  const p = provider || method || "";
  const pLower = p.toLowerCase();

  if (pLower === "stripe") {
    return paid
      ? <Tag bg="#dcfce7" color="#166534" label="Tarjeta ✅" />
      : <Tag bg="#fef3c7" color="#92400e" label="Tarjeta ⏳" />;
  }

  if (pLower === "mercadopago") {
    return paid
      ? <Tag bg="#dcfce7" color="#166534" label="MercadoPago ✅" />
      : <Tag bg="#fef3c7" color="#92400e" label="MercadoPago ⏳" />;
  }

  if (pLower === "transferencia") {
    return paid
      ? <Tag bg="#dcfce7" color="#166534" label="Transferencia ✅" />
      : <Tag bg="#fef3c7" color="#92400e" label="Transferencia ⏳" />;
  }

  if (pLower === "efectivo") {
    return <Tag bg="#f3f4f6" color="#374151" label="Efectivo 💵" />;
  }

  // Fallback: si no hay provider, mostrar método
  if (!method) return null;
  return <Tag bg="#f3f4f6" color="#374151" label={method} />;
}

function Tag({ bg, color, label }) {
  return (
    <span style={`background:${bg};color:${color};font-size:0.65rem;font-weight:600;padding:0.18rem 0.55rem;border-radius:9999px;letter-spacing:0.02em`}>
      {label}
    </span>
  );
}

function EmptyState({ filter }) {
  return (
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:3rem 1rem;text-align:center;color:#9ca3af">
      <p style="font-weight:600;color:#6b7280;margin-bottom:0.25rem">Sin pedidos</p>
      <p style="font-size:0.85rem">
        {filter === "disponibles" ? "No hay pedidos disponibles ahora mismo."
          : filter === "mios" ? "No tomaste ningún pedido todavía."
          : "Nada por acá."}
      </p>
    </div>
  );
}

function PanelLoading() {
  return (
    <div style="text-align:center;padding:4rem 1rem">
      <div style="width:40px;height:40px;margin:0 auto 0.75rem;border-radius:9999px;border:4px solid rgba(55,125,236,0.2);border-top-color:#377DEC;animation:spin 0.8s linear infinite"></div>
      <p style="color:#6b7280;font-size:0.85rem">Cargando panel...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// GananciasPanel
// ============================================================
function GananciasPanel({ profile, orders, mode }) {
  const [period, setPeriod] = useState("hoy");

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const periodStarts = {
    hoy: startOfDay,
    semana: startOfWeek,
    mes: startOfMonth,
    todo: new Date(0),
  };

  const filtered = orders.filter((o) => {
    const mine = mode === "admin" || o.repartidor_id === profile?.id;
    const delivered = o.status === "entregado";
    const inPeriod = new Date(o.created_at) >= periodStarts[period];
    return mine && delivered && (Number(o.driver_commission) || 0) > 0;
  });

  const totalGanado = filtered.reduce((s, o) => s + (Number(o.driver_commission) || 0), 0);
  const totalPedidos = filtered.length;
  const pendientesPago = filtered.filter((o) => !o.paid_to_repartidor).length;
  const totalPendiente = filtered
    .filter((o) => !o.paid_to_repartidor)
    .reduce((s, o) => s + (Number(o.driver_commission) || 0), 0);

  const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");

  const periodos = [
    { id: "hoy", label: "Hoy" },
    { id: "semana", label: "Semana" },
    { id: "mes", label: "Mes" },
    { id: "todo", label: "Histórico" },
  ];

  return (
    <div>
      <div style="display:flex;gap:0.4rem;margin-bottom:1rem;flex-wrap:wrap">
        {periodos.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={`font-size:0.78rem;padding:0.35rem 0.75rem;border-radius:9999px;border:1px solid;cursor:pointer;transition:all 0.15s;${active ? "background:#377DEC;color:#fff;border-color:#377DEC" : "background:#fff;color:#4b5563;border-color:#e5e7eb"}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1.25rem">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:1rem;text-align:center">
          <p style="font-size:1.5rem;font-weight:800;color:#16a34a;margin:0;font-family:'Poppins',sans-serif">{fmt(totalGanado)}</p>
          <p style="font-size:0.75rem;color:#6b7280;margin:0.2rem 0 0">Total ganado</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:1rem;text-align:center">
          <p style="font-size:1.5rem;font-weight:800;color:#377DEC;margin:0;font-family:'Poppins',sans-serif">{totalPedidos}</p>
          <p style="font-size:0.75rem;color:#6b7280;margin:0.2rem 0 0">Pedidos completados</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:1rem;text-align:center">
          <p style="font-size:1.5rem;font-weight:800;color:#f59e0b;margin:0;font-family:'Poppins',sans-serif">{fmt(totalPendiente)}</p>
          <p style="font-size:0.75rem;color:#6b7280;margin:0.2rem 0 0">Pendiente de pago</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:1rem;text-align:center">
          <p style="font-size:1.5rem;font-weight:800;color:#7c3aed;margin:0;font-family:'Poppins',sans-serif">{pendientesPago}</p>
          <p style="font-size:0.75rem;color:#6b7280;margin:0.2rem 0 0">Pedidos sin cobrar</p>
        </div>
      </div>

      <h3 style="font-size:0.88rem;font-weight:700;color:#374151;margin:0 0 0.6rem">Detalle</h3>
      {filtered.length === 0 ? (
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:2rem 1rem;text-align:center;color:#9ca3af;font-size:0.85rem">
          Sin ganancias en este período.
        </div>
      ) : (
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          {filtered.map((o) => (
            <div key={o.id} style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.65rem 0.875rem;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap">
              <div>
                <p style="font-size:0.82rem;font-weight:600;color:#1f2937;margin:0">
                  {o.customer_name || "Sin nombre"}
                </p>
                <p style="font-size:0.7rem;color:#9ca3af;margin:0">
                  {new Date(o.created_at).toLocaleDateString("es-AR")} · {o.services_count || "?"} servicio{(o.services_count || 1) > 1 ? "s" : ""}
                </p>
              </div>
              <div style="text-align:right">
                <p style="font-size:0.88rem;font-weight:700;color:#16a34a;margin:0">{fmt(o.driver_commission || 0)}</p>
                {o.paid_to_repartidor ? (
                  <span style="font-size:0.65rem;color:#16a34a;font-weight:600">Cobrado ✓</span>
                ) : (
                  <span style="font-size:0.65rem;color:#f59e0b;font-weight:600">Pendiente</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelError({ error, onRetry }) {
  return (
    <div style="background:#fff;border:1px solid #fecaca;border-radius:0.875rem;padding:2rem 1.5rem;text-align:center">
      <p style="color:#b91c1c;font-weight:600;margin-bottom:0.5rem">No se pudo cargar el panel</p>
      <p style="color:#7f1d1d;font-size:0.85rem;margin-bottom:1rem">{error}</p>
      <button onClick={onRetry} style="background:#377DEC;color:#fff;border:none;border-radius:0.5rem;padding:0.55rem 1.2rem;font-weight:600;cursor:pointer">Reintentar</button>
    </div>
  );
}

function servicioEmoji(name) {
  const key = (name || "").toLowerCase();
  const map = {
    mercado: "🛒", farmacia: "💊", carnicería: "🥩", carniceria: "🥩",
    "24 horas": "🌙", "24horas": "🌙", verdulería: "🥦", verduleria: "🥦",
    librería: "📚", libreria: "📚", licorería: "🍷", licoreria: "🍷",
    lavandería: "🧺", lavanderia: "🧺", ferretería: "🔧", ferreteria: "🔧",
    panadería: "🥖", panaderia: "🥖", heladería: "🍦", heladeria: "🍦",
    pescadería: "🐟", pescaderia: "🐟", "sin tacc": "🌾", sintacc: "🌾",
    dietética: "🥗", dietetica: "🥗",
  };
  return map[key] || "📦";
}
