/* ============================================================
   maps-loader.js · Carga perezosa de la API de Google Maps JS
   ------------------------------------------------------------
   La API de Google Maps se carga UNA sola vez. Cualquier módulo
   que necesite mapas (mapa.js, seleccionar-ubicacion.js) llama a
   cargarGoogleMaps() y espera la Promise.
   ============================================================ */

import { GOOGLE_MAPS_API_KEY } from "./firebase-config.js";

let promesaCarga = null;

export function cargarGoogleMaps() {
  // Si ya está cargada, resolvemos de inmediato
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }
  // Si ya se está cargando, devolvemos la misma promesa
  if (promesaCarga) return promesaCarga;

  promesaCarga = new Promise((resolve, reject) => {
    // Callback global que Google llamará al terminar de cargar
    window.__initGoogleMaps = () => resolve();

    const script = document.createElement("script");
    // 'libraries=marker' por si luego usas marcadores avanzados
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${GOOGLE_MAPS_API_KEY}` +
      `&callback=__initGoogleMaps` +
      `&libraries=marker&language=es&region=MX`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
    document.head.appendChild(script);
  });

  return promesaCarga;
}
