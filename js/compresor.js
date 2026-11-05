/* ============================================================
   js/compresor.js · Compresor inteligente de imágenes
   ------------------------------------------------------------
   VERSIÓN para Base64 en Firestore (sin Storage).
   - Comprime y redimensiona la imagen.
   - Devuelve la imagen como texto Base64 listo para guardar
     directamente en un documento de Firestore.

   IMPORTANTE - Límite de Firestore:
   Cada documento de Firestore pesa máximo 1 MB. Un crédito
   guarda 3 fotos (rostro, INE, casa). Por eso el perfil
   "cliente" comprime fuerte: cada foto queda ~110-140 KB,
   y en Base64 ~150-190 KB. Las 3 juntas caben con margen.
   ============================================================ */

/* Perfiles de compresión.
   objetivoKB es el peso del ARCHIVO comprimido (antes de Base64).
   En Base64 ocupa ~33% más, ya está contemplado en los números. */
const PERFILES = {
  // Fotos de cliente (rostro/INE/casa). 3 caben en 1 documento.
  cliente: {
    maxLado: 1100,
    objetivoKB: 130,      // archivo ~130 KB  → Base64 ~175 KB
    calidadInicial: 0.78,
    calidadMinima: 0.40
  },
  // Foto de producto (1 sola por documento, puede ser un poco mayor)
  producto: {
    maxLado: 1000,
    objetivoKB: 160,      // archivo ~160 KB  → Base64 ~215 KB
    calidadInicial: 0.80,
    calidadMinima: 0.42
  }
};

/* Detecta una sola vez si el navegador soporta WebP */
let _soportaWebP = null;
function soportaWebP() {
  if (_soportaWebP !== null) return _soportaWebP;
  const canvas = document.createElement("canvas");
  canvas.width = 1; canvas.height = 1;
  _soportaWebP = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return _soportaWebP;
}

/* ------------------------------------------------------------
   comprimirAFotoBase64(file, perfil, onProgreso)
   Comprime la imagen y la devuelve como string Base64
   (formato "data:image/...;base64,....") listo para Firestore.
   Devuelve: { base64, pesoKB, ancho, alto }
------------------------------------------------------------ */
export async function comprimirAFotoBase64(file, perfil = "cliente", onProgreso = null) {
  const cfg = PERFILES[perfil] || PERFILES.cliente;
  const aviso = (txt) => { if (onProgreso) onProgreso(txt); };

  aviso("Procesando imagen...");

  // 1. Cargar la imagen
  const img = await cargarImagen(file);

  // 2. Redimensionar manteniendo proporción
  let { width, height } = img;
  if (width > height && width > cfg.maxLado) {
    height = Math.round(height * (cfg.maxLado / width));
    width = cfg.maxLado;
  } else if (height >= width && height > cfg.maxLado) {
    width = Math.round(width * (cfg.maxLado / height));
    height = cfg.maxLado;
  }

  // 3. Dibujar en canvas con fondo blanco
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  if (img.src && img.src.startsWith("blob:")) {
    URL.revokeObjectURL(img.src);
  }

  // 4. Formato: WebP si se puede (más ligero), si no JPEG
  const usarWebP = soportaWebP();
  const tipoMime = usarWebP ? "image/webp" : "image/jpeg";

  // 5. Comprimir por objetivo de peso
  let calidad = cfg.calidadInicial;
  let base64 = canvas.toDataURL(tipoMime, calidad);
  let intentos = 0;

  while (
    pesoBase64KB(base64) > cfg.objetivoKB &&
    calidad > cfg.calidadMinima &&
    intentos < 9
  ) {
    calidad -= 0.08;
    if (calidad < cfg.calidadMinima) calidad = cfg.calidadMinima;
    base64 = canvas.toDataURL(tipoMime, calidad);
    intentos++;
    aviso(`Optimizando (${Math.round(pesoBase64KB(base64))} KB)...`);
  }

  const pesoKB = Math.round(pesoBase64KB(base64));
  aviso(`Listo (${pesoKB} KB)`);

  return { base64, pesoKB, ancho: width, alto: height };
}

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */

function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });
}

/* Calcula el peso aproximado en KB de un string Base64.
   El texto Base64 ocupa ~4/3 del tamaño real de los bytes. */
function pesoBase64KB(dataUrl) {
  // Quitamos el encabezado "data:image/...;base64,"
  const coma = dataUrl.indexOf(",");
  const soloDatos = coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl;
  // Cada caracter Base64 representa 6 bits → bytes = largo * 3/4
  const bytes = soloDatos.length * 0.75;
  return bytes / 1024;
}
