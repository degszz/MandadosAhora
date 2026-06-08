import { useEffect, useState, useRef, useMemo, useCallback } from "preact/hooks";
import { getSupabase } from "../scripts/supabase.js";

/**
 * Seguimiento de pedido para el cliente (sin login).
 * Recibe el orderId desde la URL (?id=xxx).
 * Muestra estado en tiempo real + chat con repartidor/admin.
 * Envía notificaciones del navegador cuando llegan mensajes.
 */
export default function CustomerTracker() {
  const [orderId, setOrderId] = useState(null);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [notifPermission, setNotifPermission] = useState("default");
  const scrollRef = useRef(null);
  const sb = useMemo(() => getSupabase(), []);
  const prevMsgCount = useRef(0);

  // Extract order ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      // Check localStorage for recent orders
      try {
        const stored = JSON.parse(localStorage.getItem("mandados_my_orders") || "[]");
        if (stored.length > 0) {
          setOrderId(stored[stored.length - 1].id);
          setCustomerName(stored[stored.length - 1].name || "");
        } else {
          setError("no_order");
          setLoading(false);
        }
      } catch {
        setError("no_order");
        setLoading(false);
      }
    } else {
      setOrderId(id);
      // Try to get customer name from localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("mandados_my_orders") || "[]");
        const found = stored.find((o) => o.id === id);
        if (found?.name) setCustomerName(found.name);
      } catch {}
    }
  }, []);

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const showNotification = useCallback((title, body) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: "mandados-chat",
        renotify: true,
      });
    } catch {}
  }, []);

  // Fetch order + messages + realtime
  useEffect(() => {
    if (!sb || !orderId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data: ord, error: e1 }, { data: msgs, error: e2 }] = await Promise.all([
        sb.from("orders").select("*").eq("id", orderId).maybeSingle(),
        sb.from("messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (e1 || !ord) {
        setError(e1?.message || "No se encontró el pedido.");
        setLoading(false);
        return;
      }
      setOrder(ord);
      setMessages(msgs || []);
      prevMsgCount.current = (msgs || []).length;
      if (!customerName && ord.customer_name) setCustomerName(ord.customer_name);
      setLoading(false);
    })();

    // Realtime: order changes
    const orderCh = sb
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "mandados", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder(payload.new);
          const newStatus = payload.new.status;
          const oldStatus = payload.old?.status;
          if (newStatus !== oldStatus) {
            const labels = {
              confirmado: "Tu pedido fue confirmado",
              en_camino: "Tu pedido va en camino",
              entregado: "Tu pedido fue entregado",
              cancelado: "Tu pedido fue cancelado",
            };
            if (labels[newStatus]) {
              showNotification("Mandados Ahora", labels[newStatus]);
            }
          }
        }
      )
      .subscribe();

    // Realtime: new messages
    const msgCh = sb
      .channel(`chat-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "mandados", table: "messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Notify if message is from repartidor or admin (not from self/cliente)
          if (msg.sender_role !== "cliente") {
            const who = msg.sender_role === "admin" ? "Admin" : "Repartidor";
            const senderLabel = msg.sender_name || who;
            showNotification(`${senderLabel} te escribió`, msg.content?.slice(0, 80) || "Nuevo mensaje");
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      try { orderCh.unsubscribe(); } catch {}
      try { msgCh.unsubscribe(); } catch {}
    };
  }, [sb, orderId, showNotification]);

  // Autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Send message as customer
  const send = async (e) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending || !sb || !orderId) return;
    setSending(true);
    try {
      const { error } = await sb.from("messages").insert({
        order_id: orderId,
        sender_id: null,
        sender_role: "cliente",
        sender_name: customerName || order?.customer_name || "Cliente",
        content,
      });
      if (error) throw error;
      setInput("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  // --- Renders ---

  if (loading) {
    return (
      <div style="text-align:center;padding:3rem 1rem">
        <div style="width:38px;height:38px;margin:0 auto 0.75rem;border-radius:9999px;border:4px solid rgba(55,125,236,0.2);border-top-color:#377DEC;animation:spin 0.8s linear infinite"></div>
        <p style="color:#6b7280;font-size:0.85rem">Cargando tu pedido...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error === "no_order") {
    return (
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:1rem;padding:2rem;text-align:center;max-width:28rem;margin:0 auto">
        <p style="font-size:2.5rem;margin-bottom:0.5rem">📦</p>
        <h2 style="font-size:1.1rem;font-weight:700;color:#1f2937;margin-bottom:0.5rem">No hay pedido para mostrar</h2>
        <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1rem">
          Hacé un pedido primero desde la página principal.
        </p>
        <a href="/" style="display:inline-block;background:#377DEC;color:#fff;padding:0.55rem 1.2rem;border-radius:0.5rem;font-weight:600;text-decoration:none;font-size:0.85rem">
          Ir a la home
        </a>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div style="background:#fff;border:1px solid #fecaca;border-radius:1rem;padding:2rem;text-align:center;max-width:28rem;margin:0 auto">
        <p style="color:#b91c1c;font-weight:600;margin-bottom:0.5rem">Error</p>
        <p style="color:#7f1d1d;font-size:0.85rem">{error}</p>
      </div>
    );
  }

  if (!order) return null;

  // Stepper steps
  const steps = [
    { key: "pendiente",  icon: "📦", label: "Recibido",   desc: "Tu pedido fue recibido" },
    { key: "confirmado", icon: "🛒", label: "Comprando",  desc: "El repartidor está comprando" },
    { key: "en_camino",  icon: "🛵", label: "En camino",  desc: "Tu pedido va en camino" },
    { key: "entregado",  icon: "🎉", label: "Entregado",  desc: "¡Pedido entregado!" },
  ];
  const isCancelled = order.status === "cancelado";
  const stepIndex = isCancelled ? -1 : steps.findIndex((s) => s.key === order.status);
  const currentStep = stepIndex >= 0 ? stepIndex : 0;

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div style="max-width:28rem;margin:0 auto;width:100%">
      {/* Notification banner */}
      {notifPermission === "default" && (
        <button
          onClick={requestNotifications}
          style="width:100%;background:#EBF3FF;border:1px solid #BFD7FF;color:#1e40af;padding:0.6rem 0.75rem;border-radius:0.75rem;font-size:0.8rem;font-weight:500;cursor:pointer;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;justify-content:center"
        >
          <span style="font-size:1.1rem">🔔</span>
          Activar notificaciones para saber cuando te escriban
        </button>
      )}

      {/* Cancelled banner */}
      {isCancelled && (
        <div style="background:#fee2e2;border-radius:1rem;padding:1.25rem;margin-bottom:0.75rem;text-align:center">
          <p style="font-size:2rem;margin-bottom:0.25rem">❌</p>
          <h2 style="font-size:1.15rem;font-weight:700;color:#991b1b;margin-bottom:0.25rem">Pedido cancelado</h2>
          <p style="font-size:0.85rem;color:#991b1b;opacity:0.85">Este pedido fue cancelado.</p>
        </div>
      )}

      {/* Progress stepper */}
      {!isCancelled && (
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:1rem;padding:1.25rem 1rem;margin-bottom:0.75rem">
          {/* Current status headline */}
          <div style="text-align:center;margin-bottom:1rem">
            <p style="font-size:2rem;margin-bottom:0.15rem">{steps[currentStep].icon}</p>
            <h2 style="font-size:1.1rem;font-weight:700;color:#1f2937;margin-bottom:0.15rem">{steps[currentStep].label}</h2>
            <p style="font-size:0.82rem;color:#6b7280">{steps[currentStep].desc}</p>
          </div>

          {/* Visual stepper bar */}
          <div style="display:flex;align-items:center;justify-content:center;gap:0;padding:0 0.5rem">
            {steps.map((step, i) => {
              const done = i <= currentStep;
              const isActive = i === currentStep;
              const isLast = i === steps.length - 1;
              return (
                <div key={step.key} style="display:flex;align-items:center;flex:1">
                  {/* Circle */}
                  <div style="display:flex;flex-direction:column;align-items:center;position:relative;z-index:1">
                    <div style={`width:${isActive ? "40px" : "32px"};height:${isActive ? "40px" : "32px"};border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:${isActive ? "1.15rem" : "0.85rem"};transition:all 0.4s ease;${done ? `background:${isActive ? "#377DEC" : "#dcfce7"};${isActive ? "box-shadow:0 0 0 4px rgba(55,125,236,0.2)" : ""}` : "background:#f3f4f6"}`}>
                      {done ? (
                        isActive ? <span>{step.icon}</span> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>
                      ) : (
                        <span style="color:#9ca3af">{step.icon}</span>
                      )}
                    </div>
                    <span style={`font-size:0.6rem;font-weight:${isActive ? "700" : "500"};margin-top:0.3rem;color:${done ? (isActive ? "#377DEC" : "#16a34a") : "#9ca3af"};text-align:center;white-space:nowrap`}>
                      {step.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div style={`flex:1;height:3px;margin:0 -2px;margin-bottom:1.2rem;border-radius:2px;transition:background 0.4s ease;${i < currentStep ? "background:#16a34a" : i === currentStep ? "background:linear-gradient(90deg, #377DEC 50%, #e5e7eb 50%)" : "background:#e5e7eb"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order details */}
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;padding:0.875rem;margin-bottom:0.75rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <p style="font-size:0.75rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Detalle del pedido</p>
          <span style="font-size:0.7rem;color:#9ca3af">
            {new Date(order.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Audio */}
        {order.audio_url && (
          <div style="background:#f0f4ff;border:1px solid #bfd7ff;border-radius:0.5rem;padding:0.55rem 0.7rem;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem">
            <span style="font-size:1.1rem;flex-shrink:0">🎙️</span>
            <div style="flex:1;min-width:0">
              <p style="font-size:0.72rem;font-weight:600;color:#1e40af;margin:0 0 0.25rem">Tu audio</p>
              <audio src={order.audio_url} controls preload="metadata" style="width:100%;height:32px" />
            </div>
          </div>
        )}

        {items.map((it, i) => (
          <div key={i} style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:0.5rem;padding:0.5rem 0.65rem;margin-bottom:0.35rem">
            <p style="font-weight:600;color:#1f2937;font-size:0.85rem;margin:0">{it.servicio || "Servicio"}</p>
            {it.descripcion && <p style="font-size:0.78rem;color:#4b5563;margin:0.15rem 0 0;white-space:pre-wrap">{it.descripcion}</p>}
          </div>
        ))}

        {order.address && (
          <p style="font-size:0.8rem;color:#4b5563;margin-top:0.4rem">
            📍 {order.address}
          </p>
        )}
      </div>

      {/* Chat section */}
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.875rem;overflow:hidden">
        <div style="padding:0.65rem 0.875rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
          <p style="font-size:0.85rem;font-weight:700;color:#1f2937;margin:0">💬 Chat con el repartidor</p>
          {notifPermission === "granted" && (
            <span style="font-size:0.65rem;color:#16a34a;font-weight:500">🔔 Notificaciones activas</span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} style="height:280px;overflow-y:auto;padding:0.75rem;display:flex;flex-direction:column;gap:0.4rem;background:#F3F5F6">
          {messages.length === 0 && (
            <p style="text-align:center;color:#9ca3af;font-size:0.85rem;padding:2rem 1rem">
              Sin mensajes todavía. Escribile al repartidor si necesitás algo.
            </p>
          )}
          {messages.map((m) => {
            const isMe = m.sender_role === "cliente";
            const senderLabel = isMe
              ? (m.sender_name || "Yo")
              : m.sender_role === "admin"
              ? `🛡 ${m.sender_name || "Admin"}`
              : `🛵 ${m.sender_name || "Repartidor"}`;
            return (
              <div key={m.id} style={`display:flex;${isMe ? "justify-content:flex-end" : "justify-content:flex-start"}`}>
                <div style={`max-width:80%;padding:0.5rem 0.75rem;border-radius:0.875rem;${isMe ? "background:#377DEC;color:#fff;border-bottom-right-radius:0.25rem" : "background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:0.25rem"}`}>
                  <p style={`font-size:0.65rem;font-weight:600;margin:0 0 0.15rem;${isMe ? "color:rgba(255,255,255,0.7)" : "color:#377DEC"}`}>
                    {senderLabel}
                  </p>
                  <p style="font-size:0.88rem;line-height:1.35;margin:0;white-space:pre-wrap;word-break:break-word">
                    {m.content}
                  </p>
                  <p style={`font-size:0.6rem;margin:0.1rem 0 0;text-align:right;${isMe ? "color:rgba(255,255,255,0.6)" : "color:#9ca3af"}`}>
                    {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <form onSubmit={send} style="padding:0.5rem;border-top:1px solid #e5e7eb;display:flex;gap:0.4rem;background:#fff">
          <input
            value={input}
            onInput={(e) => setInput(e.currentTarget.value)}
            placeholder="Escribí un mensaje..."
            disabled={sending || ["entregado", "cancelado"].includes(order.status)}
            maxLength={2000}
            style="flex:1;padding:0.55rem 0.75rem;border:1px solid #e5e7eb;border-radius:9999px;outline:none;font-size:0.88rem;background:#f9fafb"
            onFocus={(e) => { e.currentTarget.style.borderColor = "#377DEC"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={`width:40px;height:40px;border-radius:9999px;border:none;cursor:${!input.trim() || sending ? "not-allowed" : "pointer"};background:${!input.trim() || sending ? "#cbd5e1" : "#377DEC"};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 14l11 -11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -8l-8 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/>
            </svg>
          </button>
        </form>
      </div>

      {/* Footer */}
      <p style="text-align:center;font-size:0.7rem;color:#9ca3af;margin-top:0.75rem">
        Esta página se actualiza en tiempo real. No la cierres para recibir novedades.
      </p>
    </div>
  );
}
