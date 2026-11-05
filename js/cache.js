/* ============================================================
   js/cache.js · Caché híbrida: localStorage + IndexedDB
   ------------------------------------------------------------
   - Datos pequeños (avisos, clientes, etc.) → localStorage
   - Datos grandes (productos con imágenes base64) → IndexedDB
   
   IndexedDB no tiene límite práctico de tamaño, a diferencia
   de localStorage que se llena con las imágenes en base64 y
   falla silenciosamente causando lecturas repetidas a Firestore.
   ============================================================ */

const PREFIJO = "mx_cache_";
const IDB_NAME = "mueblimex_cache";
const IDB_STORE = "datos";
const IDB_VERSION = 1;

// Claves que van a IndexedDB (datos grandes con imágenes)
const CLAVES_IDB = new Set(["productos", "categorias"]);

// Tiempos de vida (ms)
const TTL = {
  productos:        72 * 60 * 60 * 1000,  // 72 horas — solo se actualiza al editar
  categorias:       72 * 60 * 60 * 1000,  // 72 horas
  vendedores:       10 * 60 * 1000,
  mora_calculada:   24 * 60 * 60 * 1000,
  estadisticas:     15 * 60 * 1000,
};

/* ── IndexedDB ─────────────────────────────────────────── */
let _idb = null;
function abrirIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE, { keyPath: "clave" });
    };
    req.onsuccess = (e) => { _idb = e.target.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(clave) {
  try {
    const db = await abrirIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(clave);
      req.onsuccess = () => {
        if (req.result) { resolve(req.result); return; }
        // Fallback: buscar en localStorage
        try {
          const raw = localStorage.getItem(PREFIJO + clave);
          if (raw) { resolve(JSON.parse(raw)); return; }
        } catch (_) {}
        resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    // IDB no disponible — usar localStorage
    try {
      const raw = localStorage.getItem(PREFIJO + clave);
      return raw ? JSON.parse(raw) : null;
    } catch (_2) { return null; }
  }
}

async function idbSet(clave, valor) {
  try {
    const db = await abrirIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ clave, ...valor });
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch (_) {
    // Fallback a localStorage si IDB no disponible
    try {
      // Guardar sin imágenes base64 para ahorrar espacio
      const sinImagenes = { ts: valor.ts, datos: (valor.datos || []).map(p => {
        const { imagen, imagen_base64, foto_rostro, foto_ine, foto_casa, ...rest } = p;
        return rest;
      })};
      localStorage.setItem(PREFIJO + clave, JSON.stringify(sinImagenes));
    } catch (_2) {}
  }
}

async function idbDel(clave) {
  try {
    const db = await abrirIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(clave);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch (_) {}
}

/* ── API pública ───────────────────────────────────────── */

export async function cacheSet(clave, datos) {
  const entrada = { ts: Date.now(), datos };

  if (CLAVES_IDB.has(clave)) {
    // Datos grandes → IndexedDB
    await idbSet(clave, entrada);
    return;
  }

  // Datos pequeños → localStorage
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(entrada));
  } catch (e) {
    cacheLimpiar();
    try {
      localStorage.setItem(PREFIJO + clave, JSON.stringify(entrada));
    } catch (_) {}
  }
}

export async function cacheGet(clave, ttlMs) {
  const ttl = ttlMs ?? TTL[clave] ?? (5 * 60 * 1000);

  if (CLAVES_IDB.has(clave)) {
    const entrada = await idbGet(clave);
    if (!entrada) return null;
    if (Date.now() - entrada.ts > ttl) {
      await idbDel(clave);
      return null;
    }
    return entrada.datos;
  }

  // localStorage
  try {
    const raw = localStorage.getItem(PREFIJO + clave);
    if (!raw) return null;
    const { ts, datos } = JSON.parse(raw);
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(PREFIJO + clave);
      return null;
    }
    return datos;
  } catch (_) { return null; }
}

export async function cacheInvalidar(clave) {
  if (CLAVES_IDB.has(clave)) {
    await idbDel(clave);
  } else {
    try { localStorage.removeItem(PREFIJO + clave); } catch (_) {}
  }
}

export async function cacheInvalidarVarios(...claves) {
  for (const c of claves) await cacheInvalidar(c);
}

export function cacheLimpiar() {
  try {
    const ahora = Date.now();
    const aEliminar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIJO)) continue;
      try {
        const { ts } = JSON.parse(localStorage.getItem(k));
        const clave = k.replace(PREFIJO, "");
        const ttl = TTL[clave] ?? (60 * 60 * 1000);
        if (ahora - ts > ttl) aEliminar.push(k);
      } catch (_) { aEliminar.push(k); }
    }
    aEliminar.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}
