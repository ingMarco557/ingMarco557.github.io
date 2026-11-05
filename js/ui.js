/* ============================================================
   ui.js · Utilidades de interfaz compartidas por todos los módulos
   ============================================================ */

/* ---------- TOASTS (equivalente a Toast.makeText de Android) ---------- */
export function toast(mensaje, tipo = "") {
  const cont = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast " + tipo; // tipo: "ok" | "err" | "warn" | ""
  el.textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/* ---------- MODAL GENÉRICO ---------- */
/* Abre el modal con un HTML dado. Devuelve el nodo .modal-box para
   que el llamador enganche sus propios listeners. */
export function openModal(htmlContenido) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.innerHTML = htmlContenido;
  overlay.classList.remove("hidden");
  // Cerrar al tocar el fondo oscuro
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  return box;
}
export function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

/* Modal de confirmación reutilizable (equivale a AlertDialog).
   Devuelve una Promise<boolean>. */
export function confirmDialog(titulo, mensaje, textoOk = "Aceptar", claseOk = "btn-primary") {
  return new Promise((resolve) => {
    const box = openModal(`
      <h2>${titulo}</h2>
      <p class="muted" style="white-space:pre-line">${mensaje}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cd-cancel">Cancelar</button>
        <button class="btn ${claseOk}" id="cd-ok">${textoOk}</button>
      </div>
    `);
    box.querySelector("#cd-cancel").onclick = () => { closeModal(); resolve(false); };
    box.querySelector("#cd-ok").onclick = () => { closeModal(); resolve(true); };
  });
}

/* ---------- FORMATEO DE MONEDA (es-MX) ---------- */
const fmtMX = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN"
});
export function money(valor) {
  return fmtMX.format(Number(valor) || 0);
}

/* ---------- HELPERS DE DOM ---------- */
/* Atajo para document.querySelector */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Crea un elemento con clases y contenido (mini helper) */
export function el(tag, clase = "", html = "") {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (html) n.innerHTML = html;
  return n;
}

/* Escapa texto para evitar inyección de HTML al pintar datos del servidor */
export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- CONVERTIR ARCHIVO/IMAGEN A BASE64 ----------
   Equivalente a tu bitmapToBase64() de Android.
   Útil si decides guardar fotos como string; aunque para Firebase
   es mejor usar Storage (ver storage.js). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Comprime una imagen antes de subirla (reduce peso de fotos del cliente).
   Devuelve un Blob JPEG. */
export function comprimirImagen(file, maxLado = 1024, calidad = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxLado) {
        height = height * (maxLado / width); width = maxLado;
      } else if (height > maxLado) {
        width = width * (maxLado / height); height = maxLado;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject("Error al comprimir"),
        "image/jpeg", calidad);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- LOADER GLOBAL ---------- */
export function showLoader() {
  document.getElementById("app-loader").classList.remove("hidden");
}
export function hideLoader() {
  document.getElementById("app-loader").classList.add("hidden");
}

/* ---------- SKELETON DE CARGA (placeholders) ---------- */
export function skeletonList(n = 4) {
  let h = "";
  for (let i = 0; i < n; i++) {
    h += `<div class="card" style="height:80px"><div class="skeleton" style="height:100%"></div></div>`;
  }
  return h;
}
