/**
 * Mapa y geolocalización — Mandados Ahora
 *
 * Usa Leaflet + OpenStreetMap (gratis, sin API key) para el mapa
 * embebido, Nominatim para reverse geocoding y la API nativa del
 * navegador para la geolocalización.
 *
 * El nombre del archivo (gmaps.js) se mantiene por compatibilidad
 * con los imports existentes; internamente ya no se usa Google Maps.
 */

export const INITIAL_LAT = -35.4378;
export const INITIAL_LNG = -58.8094;

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_BASE = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;

let leafletLoadPromise = null;

export function loadLeaflet() {
  if (typeof window !== "undefined" && window.L) {
    return Promise.resolve(window.L);
  }
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${LEAFLET_BASE}/leaflet.css`;
      link.dataset.leaflet = "true";
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = `${LEAFLET_BASE}/leaflet.js`;
    s.async = true;
    s.onload = () => {
      const L = window.L;
      // Los iconos por defecto de Leaflet usan paths relativos que rompen
      // cuando se carga desde CDN; los apuntamos a unpkg.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: `${LEAFLET_BASE}/images/marker-icon-2x.png`,
        iconUrl: `${LEAFLET_BASE}/images/marker-icon.png`,
        shadowUrl: `${LEAFLET_BASE}/images/marker-shadow.png`,
      });
      resolve(L);
    };
    s.onerror = () => {
      leafletLoadPromise = null;
      reject(new Error("No se pudo cargar el mapa"));
    };
    document.head.appendChild(s);
  });
  return leafletLoadPromise;
}

/**
 * Crea un mapa Leaflet con tile layer de OpenStreetMap y un marker
 * draggable. Asume que loadLeaflet() ya resolvió.
 * @returns {{ map: any, marker: any }}
 */
export function createMap(container, { lat, lng, zoom = 15 } = {}) {
  const L = window.L;
  const map = L.map(container, {
    center: [lat, lng],
    zoom,
    zoomControl: true,
  });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  // El contenedor a veces estaba oculto al construirse — forzar recálculo.
  setTimeout(() => map.invalidateSize(), 0);
  return { map, marker };
}

/**
 * Reverse geocoding via Nominatim (OpenStreetMap, sin API key).
 * Política de uso: máximo 1 req/seg, sin cargas pesadas.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1&accept-language=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("nominatim error");
    const data = await res.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

export function geolocate({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Tu navegador no soporta geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: "Permiso de ubicación denegado",
          2: "No se pudo determinar tu ubicación",
          3: "Tiempo de espera agotado",
        };
        reject(new Error(messages[err.code] || "Error de geolocalización"));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// =====================================================================
// Compat shims: src/pages/servicios/[slug].astro y src/components/
// ServiceModal.astro siguen importando los nombres pre-Leaflet
// (loadGoogleMaps, isGmapsConfigured). Se mantienen estos alias para
// que el build pase. En runtime, esos forms ya tienen un fallback que
// muestra "Mapa no disponible" si `window.google` no existe, así que
// quedan en estado degradado-aceptable hasta migrarlos a Leaflet.
// =====================================================================
export const loadGoogleMaps = loadLeaflet;
export const isGmapsConfigured = () => false;

