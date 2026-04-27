export const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

export const INITIAL_LAT = -35.4378;
export const INITIAL_LNG = -58.8094;

export function isGmapsConfigured() {
  return !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY";
}

let mapsLoadPromise = null;

export function loadGoogleMaps() {
  if (!isGmapsConfigured()) {
    return Promise.reject(new Error("Google Maps API key no configurada"));
  }
  if (typeof window !== "undefined" && window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    const cbName = `__gmapsReady_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    window[cbName] = () => {
      delete window[cbName];
      resolve(window.google);
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=${cbName}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("No se pudo cargar Google Maps"));
    };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

export function reverseGeocode(geocoder, lat, lng) {
  return new Promise((resolve) => {
    if (!geocoder) {
      resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      return;
    }
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    });
  });
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
