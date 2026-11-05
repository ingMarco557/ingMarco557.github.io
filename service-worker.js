/* ============================================================
   service-worker.js · Service Worker de la PWA
   ------------------------------------------------------------
   Permite que la app:
   - Se pueda "instalar" en el celular (icono en pantalla de inicio).
   - Cargue rápido cacheando los archivos estáticos.
   - Muestre una pantalla básica aunque no haya internet.

   NOTA: solo cacheamos los archivos de la app (HTML/CSS/JS/iconos).
   Los datos de Firebase NO se cachean aquí: Firestore ya tiene su
   propia caché offline interna.
   ============================================================ */

const CACHE = "mueblimex-v1";

/* Archivos base que se guardan al instalar la PWA */
const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/router.js",
  "./js/firebase-config.js",
  "./js/auth.js",
  "./js/data.js",
  "./js/storage.js",
  "./js/carrito.js",
  "./js/ui.js",
  "./js/maps-loader.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* INSTALACIÓN: guardamos los archivos base en caché */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

/* ACTIVACIÓN: limpiamos cachés viejas de versiones anteriores */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* FETCH: estrategia "cache first" para archivos propios.
   Las peticiones a Firebase y Google Maps pasan directo a la red. */
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // No interceptamos llamadas a Firebase ni a Google (deben ir a la red)
  if (
    url.includes("firebaseio.com") ||
    url.includes("googleapis.com") ||
    url.includes("gstatic.com") ||
    url.includes("google.com")
  ) {
    return; // el navegador la maneja normal
  }

  e.respondWith(
    caches.match(e.request).then((cacheado) => {
      // Si está en caché lo devolvemos; si no, lo pedimos a la red
      return cacheado || fetch(e.request).catch(() => {
        // Si falla todo y era una navegación, mostramos el index
        if (e.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
