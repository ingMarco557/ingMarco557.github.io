/* ============================================================
   modules/datos-cliente.js · Formulario de datos del cliente
   Equivale a DatosClienteActivity.kt + activity_datos_cliente.xml
   - Captura nombre, apellidos, RFC, CURP, dirección
   - Botón para seleccionar ubicación en el mapa
   - Valida y pasa todo a "fotos-registro"
   ============================================================ */

import { toast } from "../ui.js";
import { navega, volver } from "../router.js";

/* Guardamos los params y la ubicación a nivel de módulo para
   recuperarlos cuando volvemos de la pantalla del mapa. */
let datosVenta = {};
let ubicacion = { lat: null, lng: null };
let formCache = {}; // conserva lo escrito si el usuario va al mapa y regresa

export async function render(root, params) {
  // Si venimos del mapa, params trae { volverDeMapa:true, lat, lng }
  if (params && params.volverDeMapa) {
    ubicacion = { lat: params.lat, lng: params.lng };
  } else if (params && params.total_credito !== undefined) {
    // Llegada normal desde el carrito
    datosVenta = params;
    ubicacion = { lat: null, lng: null };
    formCache = {};
  }

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-volver">←</button>
      <h1>Datos del cliente</h1>
    </div>

    <div class="screen-pad">

      <!-- ── DATOS PERSONALES ─────────────────────────── -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:50%;
                      background:linear-gradient(135deg,#1565C0,#42A5F5);
                      display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <div style="font-weight:800;font-size:15px">Datos personales</div>
            <div style="font-size:11px;color:var(--txt2)">Información del cliente</div>
          </div>
        </div>

        <div class="field">
          <label>Nombre(s) *</label>
          <input type="text" id="f-nombre" placeholder="Ej. María Guadalupe" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Apellido paterno *</label>
            <input type="text" id="f-apePat" placeholder="Ej. García" />
            <div class="field-error hidden">Obligatorio</div>
          </div>
          <div class="field">
            <label>Apellido materno</label>
            <input type="text" id="f-apeMat" placeholder="Ej. López" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>RFC *</label>
            <input type="text" id="f-rfc" maxlength="13"
                   style="text-transform:uppercase" placeholder="XXXX000000XX0" />
            <div class="field-error hidden">Mín. 12 caracteres</div>
          </div>
          <div class="field">
            <label>CURP *</label>
            <input type="text" id="f-curp" maxlength="18"
                   style="text-transform:uppercase" placeholder="18 caracteres" />
            <div class="field-error hidden">18 caracteres</div>
          </div>
        </div>
        <div class="field">
          <label>Teléfono / WhatsApp</label>
          <input type="tel" id="f-telefono" inputmode="numeric" maxlength="10"
                 placeholder="10 dígitos" />
        </div>
      </div>

      <!-- ── DIRECCIÓN ────────────────────────────────── -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:50%;
                      background:linear-gradient(135deg,#E65100,#FF7043);
                      display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div style="font-weight:800;font-size:15px">Dirección</div>
            <div style="font-size:11px;color:var(--txt2)">Domicilio del cliente</div>
          </div>
        </div>

        <div class="field">
          <label>Calle y número *</label>
          <input type="text" id="f-calle" placeholder="Ej. Av. Central 123" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
          <div class="field">
            <label>Colonia *</label>
            <input type="text" id="f-colonia" placeholder="Ej. Centro" />
            <div class="field-error hidden">Obligatorio</div>
          </div>
          <div class="field">
            <label>C.P. *</label>
            <input type="text" id="f-cp" inputmode="numeric"
                   maxlength="5" placeholder="00000" />
            <div class="field-error hidden">Obligatorio</div>
          </div>
        </div>

        <button class="btn btn-ghost btn-block" id="btn-ubicacion"
                style="margin-top:4px;border:2px dashed var(--line)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               style="margin-right:6px">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Marcar ubicación en mapa
        </button>
        <div class="mt-8" id="ubic-status"></div>
      </div>

      <!-- ── DATOS DEL AVAL ───────────────────────────── -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="width:36px;height:36px;border-radius:50%;
                      background:linear-gradient(135deg,#6A1B9A,#AB47BC);
                      display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div style="font-weight:800;font-size:15px">Datos del aval</div>
            <div style="font-size:11px;color:var(--txt2)">
              Persona que respalda el crédito
            </div>
          </div>
        </div>

        <div class="field">
          <label>Nombre completo del aval *</label>
          <input type="text" id="f-aval-nombre"
                 placeholder="Ej. Juan Carlos Pérez Ruiz" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field">
            <label>Teléfono del aval *</label>
            <input type="tel" id="f-aval-telefono" inputmode="numeric"
                   maxlength="10" placeholder="10 dígitos" />
            <div class="field-error hidden">Obligatorio</div>
          </div>
          <div class="field">
            <label>Parentesco</label>
            <input type="text" id="f-aval-parentesco"
                   placeholder="Ej. Hermano, vecino..." />
          </div>
        </div>
        <div class="field">
          <label>Dirección del aval</label>
          <input type="text" id="f-aval-direccion"
                 placeholder="Calle, colonia..." />
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="btn-siguiente"
              style="margin-bottom:20px;padding:16px;font-size:16px;font-weight:800">
        Siguiente: capturar fotos →
      </button>
    </div>
  `;

  // Restaurar lo que el usuario había escrito (si volvió del mapa)
  for (const [campo, valor] of Object.entries(formCache)) {
    const inp = root.querySelector("#" + campo);
    if (inp) inp.value = valor;
  }

  // Mostrar estado de la ubicación
  pintarEstadoUbicacion(root);

  // Listeners
  root.querySelector("#btn-volver").addEventListener("click", volver);

  root.querySelector("#btn-ubicacion").addEventListener("click", () => {
    // Guardamos lo escrito antes de ir al mapa
    cacheForm(root);
    navega("seleccionar-ubicacion", { volverA: "datos-cliente" });
  });

  root.querySelector("#btn-siguiente").addEventListener("click", () => {
    if (validar(root)) {
      irAFotos(root);
    }
  });
}

/* Guarda el contenido del formulario en formCache */
function cacheForm(root) {
  ["f-nombre", "f-apePat", "f-apeMat", "f-rfc", "f-curp",
   "f-calle", "f-colonia", "f-cp"].forEach((id) => {
    const inp = root.querySelector("#" + id);
    if (inp) formCache[id] = inp.value;
  });
}

/* Muestra si ya se eligió ubicación */
function pintarEstadoUbicacion(root) {
  const cont = root.querySelector("#ubic-status");
  if (ubicacion.lat && ubicacion.lng) {
    cont.innerHTML = `<span class="badge aprobado">
      ✅ Ubicación marcada (${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)})
    </span>`;
  } else {
    cont.innerHTML = `<span class="muted" style="font-size:12px">Sin ubicación aún</span>`;
  }
}

/* Validación — misma lógica que validarCampos() de Android */
function validar(root) {
  let ok = true;

  const obligatorios = ["f-nombre", "f-apePat", "f-calle", "f-colonia", "f-cp"];
  obligatorios.forEach((id) => {
    const inp = root.querySelector("#" + id);
    const err = inp.parentElement.querySelector(".field-error");
    if (!inp.value.trim()) {
      inp.classList.add("invalid"); err.classList.remove("hidden"); ok = false;
    } else {
      inp.classList.remove("invalid"); err.classList.add("hidden");
    }
  });

  // RFC: mínimo 12 caracteres
  const rfc = root.querySelector("#f-rfc");
  const errRfc = rfc.parentElement.querySelector(".field-error");
  if (rfc.value.trim().length < 12) {
    rfc.classList.add("invalid"); errRfc.classList.remove("hidden"); ok = false;
  } else {
    rfc.classList.remove("invalid"); errRfc.classList.add("hidden");
  }

  // CURP: exactamente 18 caracteres
  const curp = root.querySelector("#f-curp");
  const errCurp = curp.parentElement.querySelector(".field-error");
  if (curp.value.trim().length !== 18) {
    curp.classList.add("invalid"); errCurp.classList.remove("hidden"); ok = false;
  } else {
    curp.classList.remove("invalid"); errCurp.classList.add("hidden");
  }

  // Ubicación obligatoria
  if (!ubicacion.lat || !ubicacion.lng) {
    toast("Marca la ubicación del cliente en el mapa", "warn");
    ok = false;
  }

  if (!ok && obligatorios.some((id) => !root.querySelector("#" + id).value.trim())) {
    toast("Completa los campos obligatorios", "warn");
  }

  return ok;
}

/* Empaqueta todo y navega a la captura de fotos */
function irAFotos(root) {
  const datos = {
    // Datos del cliente
    nombre:   root.querySelector("#f-nombre").value.trim(),
    apePat:   root.querySelector("#f-apePat").value.trim(),
    apeMat:   root.querySelector("#f-apeMat").value.trim(),
    rfc:      root.querySelector("#f-rfc").value.trim().toUpperCase(),
    curp:     root.querySelector("#f-curp").value.trim().toUpperCase(),
    calle:    root.querySelector("#f-calle").value.trim(),
    colonia:  root.querySelector("#f-colonia").value.trim(),
    cp:       root.querySelector("#f-cp").value.trim(),
    latitud:  ubicacion.lat,
    longitud: ubicacion.lng,
    // Datos de la venta (vienen del carrito)
    total_credito: datosVenta.total_credito,
    enganche:      datosVenta.enganche,
    total_pagos:   datosVenta.total_pagos,
    frecuencia:    datosVenta.frecuencia,
    producto_principal: datosVenta.producto_principal,
    productos:     datosVenta.productos
  };
  navega("fotos-registro", datos);
}
