/* ============================================================
   modules/editar-cliente.js · Editar datos de un cliente
   ------------------------------------------------------------
   Permite corregir nombre, apellidos, RFC, CURP, dirección y
   teléfono de un cliente ya registrado. NO permite modificar
   el saldo, total de la venta ni los pagos.
   ============================================================ */

import { editarDatosCliente } from "../data.js";
import { toast } from "../ui.js";
import { navega, volver } from "../router.js";

let clienteOriginal = null;
let ubicacion = { lat: null, lng: null };
let formCache = {};

export async function render(root, params) {
  // Si venimos del mapa
  if (params && params.volverDeMapa) {
    ubicacion = { lat: params.lat, lng: params.lng };
  } else if (params && params.cliente) {
    clienteOriginal = params.cliente;
    ubicacion = {
      lat: clienteOriginal.latitud,
      lng: clienteOriginal.longitud
    };
    formCache = {};
  }

  if (!clienteOriginal) {
    toast("Cliente no encontrado", "err");
    volver();
    return;
  }

  const c = clienteOriginal;

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-volver">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Editar cliente</h1>
    </div>

    <div class="screen-pad">
      <div class="card">
        <div class="card-title">Información personal</div>

        <div class="field">
          <label>Nombre(s) *</label>
          <input type="text" id="f-nombre" value="${attr(c.nombre)}" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div class="field">
          <label>Apellido paterno *</label>
          <input type="text" id="f-apePat" value="${attr(c.apePat)}" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div class="field">
          <label>Apellido materno</label>
          <input type="text" id="f-apeMat" value="${attr(c.apeMat)}" />
        </div>
        <div class="field">
          <label>RFC *</label>
          <input type="text" id="f-rfc" maxlength="13"
                 value="${attr(c.rfc)}" style="text-transform:uppercase" />
          <div class="field-error hidden">RFC demasiado corto (mín. 12)</div>
        </div>
        <div class="field">
          <label>CURP *</label>
          <input type="text" id="f-curp" maxlength="18"
                 value="${attr(c.curp)}" style="text-transform:uppercase" />
          <div class="field-error hidden">La CURP debe tener 18 caracteres</div>
        </div>
        <div class="field">
          <label>Teléfono del cliente</label>
          <input type="tel" id="f-telefono"
                 value="${attr(c.telefono_cliente)}" inputmode="tel" />
        </div>
      </div>

      <div class="card">
        <div class="card-title">Dirección</div>
        <div class="field">
          <label>Calle y número *</label>
          <input type="text" id="f-calle" value="${attr(c.calle)}" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div class="field">
          <label>Colonia *</label>
          <input type="text" id="f-colonia" value="${attr(c.colonia)}" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
        <div class="field">
          <label>Código postal *</label>
          <input type="text" id="f-cp" inputmode="numeric"
                 maxlength="5" value="${attr(c.cp)}" />
          <div class="field-error hidden">Campo obligatorio</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Ubicación en el mapa</div>
        <p class="muted mb-8" style="font-size:13px">
          Puedes actualizar la ubicación si la casa del cliente cambió.
        </p>
        <button class="btn btn-ghost btn-block" id="btn-ubicacion">
          📍 Cambiar ubicación
        </button>
        <div class="mt-8" id="ubic-status"></div>
      </div>

      <button class="btn btn-primary btn-block" id="btn-guardar">
        Guardar cambios
      </button>
    </div>
  `;

  // Restaurar lo del caché (si venimos del mapa)
  for (const [campo, valor] of Object.entries(formCache)) {
    const inp = root.querySelector("#" + campo);
    if (inp) inp.value = valor;
  }

  pintarEstadoUbicacion(root);

  root.querySelector("#btn-volver").addEventListener("click", volver);

  root.querySelector("#btn-ubicacion").addEventListener("click", () => {
    cacheForm(root);
    navega("seleccionar-ubicacion", { volverA: "editar-cliente" });
  });

  root.querySelector("#btn-guardar").addEventListener("click", () => {
    if (validar(root)) {
      guardar(root);
    }
  });
}

function attr(v) {
  return String(v ?? "").replace(/"/g, "&quot;");
}

function cacheForm(root) {
  ["f-nombre", "f-apePat", "f-apeMat", "f-rfc", "f-curp", "f-telefono",
   "f-calle", "f-colonia", "f-cp"].forEach((id) => {
    const inp = root.querySelector("#" + id);
    if (inp) formCache[id] = inp.value;
  });
}

function pintarEstadoUbicacion(root) {
  const cont = root.querySelector("#ubic-status");
  if (ubicacion.lat && ubicacion.lng) {
    cont.innerHTML = `<span class="badge aprobado">
      ✅ Ubicación: ${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}
    </span>`;
  } else {
    cont.innerHTML = `<span class="muted" style="font-size:12px">Sin ubicación</span>`;
  }
}

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

  const rfc = root.querySelector("#f-rfc");
  const errRfc = rfc.parentElement.querySelector(".field-error");
  if (rfc.value.trim().length < 12) {
    rfc.classList.add("invalid"); errRfc.classList.remove("hidden"); ok = false;
  } else {
    rfc.classList.remove("invalid"); errRfc.classList.add("hidden");
  }

  const curp = root.querySelector("#f-curp");
  const errCurp = curp.parentElement.querySelector(".field-error");
  if (curp.value.trim().length !== 18) {
    curp.classList.add("invalid"); errCurp.classList.remove("hidden"); ok = false;
  } else {
    curp.classList.remove("invalid"); errCurp.classList.add("hidden");
  }

  if (!ok) toast("Revisa los campos marcados", "warn");
  return ok;
}

async function guardar(root) {
  const btn = root.querySelector("#btn-guardar");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    await editarDatosCliente(clienteOriginal.id, {
      nombre:  root.querySelector("#f-nombre").value.trim(),
      apePat:  root.querySelector("#f-apePat").value.trim(),
      apeMat:  root.querySelector("#f-apeMat").value.trim(),
      rfc:     root.querySelector("#f-rfc").value.trim().toUpperCase(),
      curp:    root.querySelector("#f-curp").value.trim().toUpperCase(),
      telefono_cliente: root.querySelector("#f-telefono").value.trim(),
      calle:   root.querySelector("#f-calle").value.trim(),
      colonia: root.querySelector("#f-colonia").value.trim(),
      cp:      root.querySelector("#f-cp").value.trim(),
      latitud: ubicacion.lat,
      longitud: ubicacion.lng
    });
    toast("Datos actualizados", "ok");
    volver();
  } catch (e) {
    console.error(e);
    toast("Error al guardar: " + (e.message || ""), "err");
    btn.disabled = false;
    btn.textContent = "Guardar cambios";
  }
}
