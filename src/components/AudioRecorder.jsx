import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { getSupabase } from "../scripts/supabase.js";

const WA_NUMBER = "2271415182"; // mismo número usado en src/scripts/cart.js

const SERVICIOS = [
  { key: "mercado", label: "Mercado" },
  { key: "carniceria", label: "Carnicería" },
  { key: "verduleria", label: "Verdulería" },
  { key: "panaderia", label: "Panadería" },
  { key: "farmacia", label: "Farmacia" },
  { key: "libreria", label: "Librería" },
  { key: "licoreria", label: "Licorería" },
  { key: "lavanderia", label: "Lavandería" },
  { key: "24horas", label: "24 Horas" },
  { key: "mas", label: "Otro / Personalizado" },
];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function extFromMime(mime) {
  if (!mime) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function AudioRecorder() {
  const [isOpen, setIsOpen] = useState(false);
  const [servicio, setServicio] = useState(SERVICIOS[0].key);
  const [nombre, setNombre] = useState("");
  const [status, setStatus] = useState("idle"); // idle | recording | recorded | sending | sent | error
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMime, setAudioMime] = useState("");
  const [volume, setVolume] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const downloadAnchorRef = useRef(null);
  const blobRef = useRef(null);

  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
  }, []);

  const resetAudio = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioMime("");
    setSeconds(0);
    setVolume(0);
    chunksRef.current = [];
    blobRef.current = null;
    setStatus("idle");
    setError(null);
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no soporta grabación de audio.");
      setStatus("error");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Tu navegador no soporta grabación de audio.");
      setStatus("error");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError("Necesitamos permiso para usar el micrófono.");
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    const mime = pickMimeType();
    setAudioMime(mime);
    chunksRef.current = [];

    let recorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setError("No se pudo iniciar la grabación en este navegador.");
      setStatus("error");
      return;
    }

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    });
    recorder.addEventListener("stop", () => {
      const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setStatus("recorded");
    });

    recorderRef.current = recorder;
    recorder.start(250);

    // Visualizer
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setVolume(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Sin visualizer si falla AudioContext, no es bloqueante.
    }

    // Timer
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cerrar modal con Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopAll();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    if (status === "recording") stopAll();
    setIsOpen(false);
  };

  const filename = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `pedido-${servicio}-${ts}.${extFromMime(audioMime)}`;
  };

  const triggerDownload = () => {
    if (!audioUrl) return;
    const a = downloadAnchorRef.current;
    if (a) {
      a.href = audioUrl;
      a.download = filename();
      a.click();
    }
  };

  const sendToWhatsapp = () => {
    triggerDownload();
    const servicioLabel = SERVICIOS.find((s) => s.key === servicio)?.label || servicio;
    const msg =
`🎙️ *Audio de pedido — Mandados Ahora*

Servicio: *${servicioLabel}*

Te dejé un audio describiendo lo que necesito.
📎 Adjuntalo desde el clip de WhatsApp (lo descargué a "Descargas" como ${filename()}).`;
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  /** Upload audio to Supabase Storage + create order */
  const sendToSupabase = async () => {
    const blob = blobRef.current;
    if (!blob) return;

    setStatus("sending");
    setError(null);

    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Supabase no configurado. Revisá el .env.");

      // 1. Upload audio to storage
      const fname = filename();
      const { data: uploadData, error: uploadErr } = await sb.storage
        .from("audio-pedidos")
        .upload(fname, blob, {
          contentType: blob.type || "audio/webm",
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      // 2. Get public URL
      const { data: urlData } = sb.storage
        .from("audio-pedidos")
        .getPublicUrl(uploadData.path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("No se pudo obtener la URL del audio.");

      // 3. Create order in mandados.orders
      const servicioLabel = SERVICIOS.find((s) => s.key === servicio)?.label || servicio;
      const payload = {
        customer_name: nombre.trim() || null,
        customer_email: null,
        items: [{
          servicio: servicioLabel,
          negocio: "",
          descripcion: `🎙️ Pedido por audio (${fmtTime(seconds)})`,
          cantidad: 1,
          imagen: null,
        }],
        address: "",
        payment_method: "efectivo",
        payment_status: "pendiente",
        status: "pendiente",
        audio_url: publicUrl,
      };

      const { data: orderData, error: insertErr } = await sb.from("orders").insert(payload).select("id").single();
      if (insertErr) throw insertErr;

      // Guardar order ID en localStorage para seguimiento
      if (orderData?.id) {
        try {
          const stored = JSON.parse(localStorage.getItem("mandados_my_orders") || "[]");
          stored.push({ id: orderData.id, name: nombre.trim() || "", created: new Date().toISOString() });
          if (stored.length > 20) stored.splice(0, stored.length - 20);
          localStorage.setItem("mandados_my_orders", JSON.stringify(stored));
        } catch {}
      }

      setStatus("sent");
      // Redirigir a seguimiento después de 2 segundos
      if (orderData?.id) {
        setTimeout(() => {
          window.location.href = `/pedido?id=${orderData.id}`;
        }, 2000);
      }
    } catch (e) {
      console.error("[AudioRecorder] error subiendo:", e);
      setError(e?.message || "No se pudo enviar el pedido.");
      setStatus("recorded"); // volver a recorded para reintentar
    }
  };

  // ---------- Visualizer (5 barras + punto pulsante) ----------
  const renderVisualizer = () => {
    const bars = [0.3, 0.6, 1, 0.6, 0.3];
    return (
      <div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;height:80px;margin:0.5rem 0">
        <span
          aria-hidden
          style="width:14px;height:14px;border-radius:9999px;background:#ef4444;animation:audio-pulse 1.1s ease-in-out infinite"
        />
        <div style="display:flex;align-items:flex-end;gap:5px;height:60px">
          {bars.map((mult, i) => {
            const h = Math.max(6, 8 + volume * 60 * mult);
            return (
              <span
                key={i}
                style={`display:inline-block;width:6px;height:${h}px;background:#377DEC;border-radius:3px;transition:height 80ms linear`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Botón flotante */}
      <div style="position:fixed;bottom:1.5rem;left:1.5rem;z-index:1100">
        <button
          type="button"
          onClick={openModal}
          aria-label="Grabar audio de pedido"
          style="background:#377DEC;color:#fff;border:none;cursor:pointer;width:56px;height:56px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 25px -5px rgba(0,0,0,0.25);transition:transform 0.2s,background 0.2s"
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.background = "#2563c0"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "#377DEC"; }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M9 2m0 3a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3z" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M8 21l8 0" />
            <path d="M12 17l0 4" />
          </svg>
        </button>
      </div>

      {/* Anchor invisible para descargas */}
      <a ref={downloadAnchorRef} style="display:none" />

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={closeModal}
            class="animate-fade-in animate-duration-faster"
            style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1200"
          />

          {/* Card */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Grabar audio de pedido"
            class="animate-fade-in animate-duration-faster"
            style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1201;width:calc(100% - 2rem);max-width:28rem;background:#fff;border-radius:1rem;padding:1.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);border:1px solid #e5e7eb"
          >
            {/* Header */}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
              <div style="display:flex;align-items:center;gap:0.5rem">
                <div style="width:36px;height:36px;border-radius:9999px;background:#EBF3FF;display:flex;align-items:center;justify-content:center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#377DEC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M9 2m0 3a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3z" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <path d="M8 21l8 0" />
                    <path d="M12 17l0 4" />
                  </svg>
                </div>
                <h2 style="font-size:1.05rem;font-weight:700;color:#1f2937">Audio de pedido</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Cerrar"
                style="padding:6px;border-radius:8px;background:transparent;border:none;cursor:pointer;color:#6b7280"
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nombre + Selector de servicio */}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">
              <label>
                <span style="display:block;font-size:0.7rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.35rem">Tu nombre</span>
                <input
                  type="text"
                  value={nombre}
                  onInput={(e) => setNombre(e.currentTarget.value)}
                  placeholder="Ej: Juan"
                  disabled={status === "recording" || status === "sending"}
                  style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;outline:none;font-size:0.9rem;background:#fff;box-sizing:border-box"
                />
              </label>
              <label>
                <span style="display:block;font-size:0.7rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.35rem">Servicio</span>
                <select
                  value={servicio}
                  onChange={(e) => setServicio(e.currentTarget.value)}
                  disabled={status === "recording" || status === "sending"}
                  style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:0.5rem;outline:none;font-size:0.9rem;background:#fff;cursor:pointer;box-sizing:border-box"
                >
                  {SERVICIOS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Estado: idle */}
            {status === "idle" && (
              <div style="text-align:center;padding:1rem 0">
                <p style="color:#6b7280;font-size:0.875rem;margin-bottom:1rem">
                  Tocá grabar y describí lo que necesitás.
                </p>
                <button
                  type="button"
                  onClick={startRecording}
                  style="background:#ef4444;color:#fff;border:none;cursor:pointer;padding:0.7rem 1.4rem;border-radius:9999px;font-weight:600;display:inline-flex;align-items:center;gap:0.5rem;font-size:0.95rem;transition:background 0.15s"
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#dc2626"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#ef4444"; }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                  Grabar audio
                </button>
              </div>
            )}

            {/* Estado: recording */}
            {status === "recording" && (
              <div style="text-align:center">
                {renderVisualizer()}
                <p style="font-variant-numeric:tabular-nums;font-size:1.25rem;font-weight:700;color:#1f2937;margin:0.25rem 0 0.75rem">{fmtTime(seconds)}</p>
                <button
                  type="button"
                  onClick={stopRecording}
                  style="background:#1f2937;color:#fff;border:none;cursor:pointer;padding:0.7rem 1.4rem;border-radius:9999px;font-weight:600;display:inline-flex;align-items:center;gap:0.5rem;font-size:0.95rem"
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#000"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#1f2937"; }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Detener
                </button>
              </div>
            )}

            {/* Estado: recorded */}
            {status === "recorded" && audioUrl && (
              <div>
                <audio
                  src={audioUrl}
                  controls
                  style="width:100%;margin-bottom:0.75rem"
                />
                <p style="font-size:0.75rem;color:#9ca3af;text-align:center;margin-bottom:0.75rem">
                  Duración aprox: {fmtTime(seconds)}
                </p>

                {error && (
                  <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:0.5rem 0.65rem;border-radius:0.5rem;margin-bottom:0.6rem;font-size:0.8rem">
                    ⚠️ {error}
                  </div>
                )}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                  <button
                    type="button"
                    onClick={resetAudio}
                    style="background:#fff;color:#4b5563;border:1px solid #e5e7eb;cursor:pointer;padding:0.55rem;border-radius:0.5rem;font-weight:500;font-size:0.85rem"
                  >
                    ↻ Volver a grabar
                  </button>
                  <button
                    type="button"
                    onClick={triggerDownload}
                    style="background:#fff;color:#377DEC;border:1px solid #BFD7FF;cursor:pointer;padding:0.55rem;border-radius:0.5rem;font-weight:600;font-size:0.85rem"
                  >
                    ⬇ Descargar
                  </button>
                </div>

                {/* Enviar como pedido a Supabase */}
                <button
                  type="button"
                  onClick={sendToSupabase}
                  style="width:100%;background:#377DEC;color:#fff;border:none;cursor:pointer;padding:0.7rem;border-radius:0.5rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;font-size:0.95rem;margin-bottom:0.5rem;transition:background 0.15s"
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#2563c0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#377DEC"; }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15 8h.01"/><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z"/>
                    <path d="M3.5 15.5l4.5-4.5c.928-.893 2.072-.893 3 0l5 5"/>
                    <path d="M14 14l1-1c.928-.893 2.072-.893 3 0l2.5 2.5"/>
                  </svg>
                  Enviar pedido por audio
                </button>

                <button
                  type="button"
                  onClick={sendToWhatsapp}
                  style="width:100%;background:#25D366;color:#fff;border:none;cursor:pointer;padding:0.7rem;border-radius:0.5rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;font-size:0.95rem"
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#1da851"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#25D366"; }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
                    <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
                  </svg>
                  Enviar por WhatsApp
                </button>
                <p style="font-size:0.7rem;color:#9ca3af;text-align:center;margin-top:0.5rem">
                  "Enviar pedido" lo sube al panel de repartidores. "WhatsApp" descarga el audio y abre WhatsApp.
                </p>
              </div>
            )}

            {/* Estado: sending */}
            {status === "sending" && (
              <div style="text-align:center;padding:2rem 0">
                <div style="width:38px;height:38px;margin:0 auto 0.75rem;border-radius:9999px;border:4px solid rgba(55,125,236,0.2);border-top-color:#377DEC;animation:spin 0.8s linear infinite"></div>
                <p style="color:#6b7280;font-size:0.875rem">Subiendo audio y creando pedido...</p>
              </div>
            )}

            {/* Estado: sent */}
            {status === "sent" && (
              <div style="text-align:center;padding:1.5rem 0">
                <div style="width:56px;height:56px;margin:0 auto 0.75rem;border-radius:9999px;background:#dcfce7;display:flex;align-items:center;justify-content:center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12l5 5l10 -10"/>
                  </svg>
                </div>
                <p style="font-size:1rem;font-weight:700;color:#1f2937;margin-bottom:0.25rem">¡Pedido enviado!</p>
                <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1rem">
                  Tu audio ya está en el panel. Un repartidor lo va a escuchar y atender.
                </p>
                <button
                  type="button"
                  onClick={() => { resetAudio(); setNombre(""); }}
                  style="background:#377DEC;color:#fff;border:none;cursor:pointer;padding:0.55rem 1.2rem;border-radius:0.5rem;font-weight:600;font-size:0.875rem"
                >
                  Grabar otro pedido
                </button>
              </div>
            )}

            {/* Estado: error */}
            {status === "error" && (
              <div style="text-align:center;padding:1rem 0">
                <p style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:0.75rem;border-radius:0.5rem;font-size:0.875rem;margin-bottom:1rem">
                  ⚠️ {error}
                </p>
                <button
                  type="button"
                  onClick={() => { setStatus("idle"); setError(null); }}
                  style="background:#377DEC;color:#fff;border:none;cursor:pointer;padding:0.55rem 1.2rem;border-radius:0.5rem;font-weight:500;font-size:0.875rem"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>

          {/* Keyframes */}
          <style>{`
            @keyframes audio-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50%      { opacity: 0.4; transform: scale(1.35); }
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </>
      )}
    </>
  );
}
