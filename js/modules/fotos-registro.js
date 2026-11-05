/* ============================================================
   modules/fotos-registro.js · Captura de 3 fotos + envío final
   Equivale a PlazosYFotosActivity.kt + activity_plazos_yfotos.xml
   - Captura foto de rostro, INE y casa (usa la cámara del celular)
   - Sube las 3 fotos a Firebase Storage
   - Crea la solicitud de crédito en Firestore
   ============================================================ */

import { crearSolicitudCompleta } from "../data.js";
import { subirVarias } from "../storage.js";
import { getPerfil } from "../auth.js";
import { money, toast, esc } from "../ui.js";
import { navega, volver } from "../router.js";

/* Archivos seleccionados (objetos File) */
let fotoRostro  = null;
let fotoIneFrente = null;
let fotoIneAtras  = null;
let fotoCasa1   = null;
let fotoCasa2   = null;
let datos = {};

export async function render(root, params) {
  datos = params || {};
  fotoRostro = fotoIneFrente = fotoIneAtras = fotoCasa1 = fotoCasa2 = null;

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-volver">←</button>
      <h1>Fotos del registro</h1>
    </div>

    <div class="screen-pad">
      <div class="card">
        <div class="card-title">Resumen de la solicitud</div>
        <div class="sim-row"><span>Cliente</span>
          <strong>${esc(datos.nombre)} ${esc(datos.apePat)}</strong></div>
        <div class="sim-row"><span>Total a crédito</span>
          <strong>${money(datos.total_credito)}</strong></div>
        <div class="sim-row"><span>Enganche</span>
          <strong>${money(datos.enganche)}</strong></div>
        <div class="sim-row"><span>Plan</span>
          <strong>${datos.total_pagos} pagos · ${esc(datos.frecuencia)}</strong></div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-weight:800;font-size:16px;margin-bottom:4px">
          📸 Fotografías requeridas
        </div>
        <div style="font-size:12px;color:var(--txt2)">
          Toma fotos claras y bien iluminadas
        </div>
      </div>

      <!-- Foto del cliente -->
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:28px;height:28px;border-radius:50%;background:#1565C0;
                      color:#fff;font-size:12px;font-weight:800;display:flex;
                      align-items:center;justify-content:center">1</div>
          <div style="font-weight:700;font-size:14px">Cliente</div>
        </div>
        ${photoSlotHTML("rostro", "📷 Foto del rostro del cliente", "Foto de frente, con buena iluminación")}
      </div>

      <!-- INE -->
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:28px;height:28px;border-radius:50%;background:#6A1B9A;
                      color:#fff;font-size:12px;font-weight:800;display:flex;
                      align-items:center;justify-content:center">2</div>
          <div style="font-weight:700;font-size:14px">INE del cliente</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${photoSlotHTML("ine-frente", "🪪 Frente de la INE", "Parte frontal con foto")}
          ${photoSlotHTML("ine-atras",  "🪪 Reverso de la INE", "Parte trasera con código")}
        </div>
      </div>

      <!-- Casa -->
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:28px;height:28px;border-radius:50%;background:#E65100;
                      color:#fff;font-size:12px;font-weight:800;display:flex;
                      align-items:center;justify-content:center">3</div>
          <div style="font-weight:700;font-size:14px">Casa del cliente</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${photoSlotHTML("casa1", "🏠 Foto exterior 1", "Fachada de la casa")}
          ${photoSlotHTML("casa2", "🏠 Foto exterior 2", "Otra ángulo o número")}
        </div>
      </div>

      <button class="btn btn-green btn-block mt-16" id="btn-enviar">
        Enviar solicitud al gerente
      </button>
    </div>
  `;

  root.querySelector("#btn-volver").addEventListener("click", volver);

  // Conectar los 5 slots
  conectarSlot(root, "rostro",    (f) => fotoRostro    = f);
  conectarSlot(root, "ine-frente",(f) => fotoIneFrente = f);
  conectarSlot(root, "ine-atras", (f) => fotoIneAtras  = f);
  conectarSlot(root, "casa1",     (f) => fotoCasa1     = f);
  conectarSlot(root, "casa2",     (f) => fotoCasa2     = f);

  root.querySelector("#btn-enviar").addEventListener("click", () => {
    enviarSolicitud(root);
  });
}

/* HTML de un slot de foto.
   El atributo capture="environment" abre la cámara trasera en el móvil. */
function photoSlotHTML(id, etiqueta) {
  return `
    <div class="photo-slot" id="slot-${id}">
      <div class="ph-placeholder" id="ph-${id}">
        <div style="font-size:36px">🖼️</div>
        <div class="muted" style="font-size:13px">${etiqueta}</div>
      </div>
      <img id="img-${id}" class="hidden" alt="">
      <input type="file" id="file-${id}" accept="image/*" capture="environment">
      <button class="btn btn-ghost btn-sm" id="btn-${id}">Tomar / elegir foto</button>
    </div>
  `;
}

/* Conecta el input file de un slot con su preview */
function conectarSlot(root, id, guardar) {
  const input = root.querySelector("#file-" + id);
  const boton = root.querySelector("#btn-" + id);
  const img = root.querySelector("#img-" + id);
  const ph = root.querySelector("#ph-" + id);

  boton.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    guardar(file);
    // Preview
    img.src = URL.createObjectURL(file);
    img.classList.remove("hidden");
    ph.classList.add("hidden");
    boton.textContent = "Cambiar foto";
  });
}

/* Envía la solicitud completa:
   1. Valida que estén las 3 fotos
   2. Sube las fotos a Storage
   3. Crea el documento de crédito en Firestore */
async function enviarSolicitud(root) {
  // 1. Validar fotos
  if (!fotoRostro || !fotoIne || !fotoCasa) {
    toast("Captura las 3 fotografías requeridas", "warn");
    return;
  }

  const btn = root.querySelector("#btn-enviar");
  btn.disabled = true;
  btn.textContent = "Subiendo fotos...";

  try {
    const perfil = await getPerfil();
    if (!perfil) {
      toast("Sesión caducada. Reinicia sesión.", "err");
      btn.disabled = false;
      btn.textContent = "Enviar solicitud al gerente";
      return;
    }

    // 2. Subir las 3 fotos en paralelo a Storage
    const [urlRostro, urlIne, urlCasa] = await subirVarias(
      [fotoRostro, fotoIne, fotoCasa],
      `clientes/${perfil.uid}`
    );

    btn.textContent = "Guardando solicitud...";

    // 3. Crear la solicitud de crédito en Firestore
    await crearSolicitudCompleta({
      // Datos del cliente
      nombre:  datos.nombre,
      apePat:  datos.apePat,
      apeMat:  datos.apeMat,
      rfc:     datos.rfc,
      curp:    datos.curp,
      calle:   datos.calle,
      colonia: datos.colonia,
      cp:      datos.cp,
      latitud:  datos.latitud,
      longitud: datos.longitud,
      direccion_completa:
        `${datos.calle}, ${datos.colonia}, C.P. ${datos.cp}`,
      // Datos del vendedor
      cv_usuario: perfil.uid,
      nombre_vendedor: perfil.nombre,
      // Datos del producto / venta (guardamos TODOS los items del carrito)
      cv_producto: datos.producto_principal?.id || "",
      producto: datos.producto_principal?.nombre || "",
      descripcion_producto: datos.producto_principal?.descripcion || "",
      items: Array.isArray(datos.productos) && datos.productos.length > 0
        ? datos.productos.map((p) => ({
            id: p.id || "",
            nombre: p.nombre || "",
            cantidad: Number(p.cantidad) || 1,
            precio: Number(p.precio) || 0
          }))
        : [{ id: datos.producto_principal?.id || "", nombre: datos.producto_principal?.nombre || "", cantidad: 1, precio: datos.producto_principal?.precio || 0 }],
      total_venta: datos.total_credito,
      enganche: datos.enganche,
      total_pagos: datos.total_pagos,
      frecuencia: datos.frecuencia,
      dias_restantes: datos.frecuencia === "Quincenal" ? 15 : 30,
      // Fotos (URLs de Storage)
      foto_rostro:       urlRostro,
      foto_ine_frente:   urlIneFrente,
      foto_ine_atras:    urlIneAtras,
      foto_casa1:        urlCasa1,
      foto_casa2:        urlCasa2,
      // Datos del aval
      aval_nombre:       datos.aval?.nombre     || "",
      aval_telefono:     datos.aval?.telefono   || "",
      aval_parentesco:   datos.aval?.parentesco || "",
      aval_direccion:    datos.aval?.direccion  || "",
      telefono:          datos.telefono         || ""
    });

    toast("¡Solicitud enviada con éxito!", "ok");
    // Limpiamos el carrito tras una venta exitosa
    const { limpiarCarrito } = await import("../carrito.js");
    limpiarCarrito();
    navega("inicio");

  } catch (e) {
    console.error(e);
    toast("Error al enviar: " + (e.message || "intenta de nuevo"), "err");
    btn.disabled = false;
    btn.textContent = "Enviar solicitud al gerente";
  }
}
