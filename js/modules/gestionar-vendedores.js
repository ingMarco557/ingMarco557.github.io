/* ============================================================
   modules/gestionar-vendedores.js · Gestión de vendedores
   ------------------------------------------------------------
   VERSIÓN MEJORADA:
   El gerente crea un vendedor con un formulario NORMAL
   (nombre, usuario, contraseña, teléfono, cartera).
   La app crea la cuenta de acceso Y el perfil automáticamente.
   NO se necesita UID ni entrar a Firebase Console.
   ============================================================ */

import {
  getVendedores, crearVendedorCompleto, editarVendedor,
  cambiarEstadoVendedor, actualizarLoginVendedor
} from "../data.js";
import {
  cambiarPasswordVendedor, cambiarLoginVendedor, crearCuentaVendedor
} from "../auth-admin.js";
import {
  money, esc, toast, confirmDialog, skeletonList, openModal, closeModal
} from "../ui.js";
import { volver } from "../router.js";
import { getColoniasVendedor, actualizarColoniasVendedor } from "../data.js";
import { COLONIAS_COMITAN, coloniasPorZona } from "../colonias-comitan.js";

export async function render(root) {
  await pintarLista(root);
}

/* ---------------- VISTA LISTA ---------------- */
async function pintarLista(root) {
  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Gestionar Vendedores</h1>
    </div>
    <div class="screen-pad" id="cont-vendedores">
      ${skeletonList(4)}
    </div>
    <button class="fab" id="fab-nuevo">+</button>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);
  root.querySelector("#fab-nuevo").addEventListener("click", () =>
    dialogoCrear(root));

  try {
    const vendedores = await getVendedores();
    const cont = root.querySelector("#cont-vendedores");

    if (vendedores.length === 0) {
      cont.innerHTML = `<div class="empty-state">
        <div class="es-icon">👔</div>No hay vendedores registrados.<br>
        Toca + para agregar uno.</div>`;
      return;
    }

    cont.innerHTML = vendedores.map((v) => `
      <div class="card">
        <div class="row-between">
          <div class="li-name">${esc(v.nombre || "Sin nombre")}</div>
          <span class="badge ${v.activo === false ? "inactivo" : "activo"}">
            ${v.activo === false ? "Inactivo" : "Activo"}
          </span>
        </div>
        <div class="li-sub">👤 ${esc(v.login || "—")}</div>
        <div class="li-sub">📞 ${esc(v.telefono || "Sin teléfono")}</div>
        <div class="li-sub">💰 Cartera: ${money(v.cartera)}</div>

        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" data-editar="${v.id}">✏️ Editar</button>
          <button class="btn btn-sm btn-primary" data-seguridad="${v.id}">🔑 Seguridad</button>
          <button class="btn btn-sm" style="background:#8B5CF6;color:#fff" data-permisos="${v.id}">🔓 Permisos</button>
          <button class="btn btn-sm" style="background:#0277BD;color:#fff" data-colonias="${v.id}">🗺️ Zona</button>
          <button class="btn btn-sm ${v.activo === false ? "btn-green" : "btn-red"}"
                  data-estado="${v.id}">
            ${v.activo === false ? "✅ Activar" : "🚫 Desactivar"}
          </button>
        </div>
      </div>
    `).join("");

    cont.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => {
        const v = vendedores.find((x) => x.id === b.dataset.editar);
        dialogoEditar(root, v);
      }));

    cont.querySelectorAll("[data-seguridad]").forEach((b) =>
      b.addEventListener("click", () => {
        const v = vendedores.find((x) => x.id === b.dataset.seguridad);
        dialogoSeguridad(root, v);
      }));

    cont.querySelectorAll("[data-permisos]").forEach((b) =>
      b.addEventListener("click", () => {
        const v = vendedores.find((x) => x.id === b.dataset.permisos);
        dialogoPermisos(root, v);
      }));

    cont.querySelectorAll("[data-colonias]").forEach((b) =>
      b.addEventListener("click", () => {
        const v = vendedores.find((x) => x.id === b.dataset.colonias);
        dialogoColonias(root, v);
      }));

    cont.querySelectorAll("[data-estado]").forEach((b) =>
      b.addEventListener("click", async () => {
        const v = vendedores.find((x) => x.id === b.dataset.estado);
        const activar = v.activo === false;
        const ok = await confirmDialog(
          activar ? "✅ Activar vendedor" : "🚫 Desactivar vendedor",
          activar
            ? `¿Reactivar la cuenta de ${v.nombre}?`
            : `¿Desactivar a ${v.nombre}? No podrá iniciar sesión.`,
          activar ? "Activar" : "Desactivar",
          activar ? "btn-green" : "btn-red");
        if (!ok) return;
        try {
          await cambiarEstadoVendedor(v.id, activar);
          toast(activar ? "Vendedor activado" : "Vendedor desactivado", "ok");
          pintarLista(root);
        } catch (e) {
          console.error(e);
          toast("No se pudo cambiar el estado", "err");
        }
      }));

  } catch (e) {
    console.error(e);
    root.querySelector("#cont-vendedores").innerHTML =
      `<div class="empty-state"><div class="es-icon">⚠️</div>Error al cargar vendedores</div>`;
  }
}

/* ---------------- DIÁLOGO: CREAR VENDEDOR (NUEVO) ---------------- */
function dialogoCrear(root) {
  const box = openModal(`
    <h2>Nuevo vendedor</h2>
    <p class="muted" style="font-size:13px;margin-bottom:16px">
      Completa los datos. La cuenta de acceso se crea automáticamente.
    </p>

    <div class="field">
      <label>Nombre completo *</label>
      <input type="text" id="v-nombre" placeholder="Ej. Carlos Ramírez">
    </div>
    <div class="field">
      <label>Usuario (para iniciar sesión) *</label>
      <input type="text" id="v-login" placeholder="ej. vendedor02"
             autocapitalize="none" autocomplete="off">
    </div>
    <div class="field">
      <label>Contraseña *</label>
      <input type="text" id="v-password" placeholder="Mínimo 8 caracteres"
             autocomplete="off" oninput="window._checkPass(this.value)">
      <!-- Indicador de fortaleza -->
      <div id="pass-strength" style="margin-top:6px;display:none">
        <div style="height:6px;border-radius:100px;background:var(--line);overflow:hidden">
          <div id="pass-barra" style="height:100%;width:0%;transition:width .3s,background .3s;border-radius:100px"></div>
        </div>
        <div id="pass-texto" style="font-size:11px;margin-top:4px;font-weight:700"></div>
        <div id="pass-tip" style="font-size:10px;color:var(--txt2);margin-top:2px"></div>
      </div>
      <div class="muted" style="font-size:11px;margin-top:4px">
        Anota esta contraseña para dársela al vendedor.
      </div>
    </div>
    <div class="field">
      <label>Teléfono</label>
      <input type="tel" id="v-telefono" inputmode="tel">
    </div>
    <div class="field">
      <label>Cartera asignada</label>
      <input type="number" id="v-cartera" value="50000" inputmode="decimal">
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" id="v-cancel">Cancelar</button>
      <button class="btn btn-primary" id="v-guardar">Crear vendedor</button>
    </div>
  `);

  box.querySelector("#v-cancel").addEventListener("click", closeModal);
  box.querySelector("#v-guardar").addEventListener("click", async () => {
    const nombre = box.querySelector("#v-nombre").value.trim();
    const login = box.querySelector("#v-login").value.trim();
    const password = box.querySelector("#v-password").value.trim();
    const telefono = box.querySelector("#v-telefono").value.trim();
    const cartera = parseFloat(box.querySelector("#v-cartera").value) || 0;

    // Validaciones
    if (!nombre || !login || !password) {
      toast("Nombre, usuario y contraseña son obligatorios", "warn");
      return;
    }
    if (password.length < 8) {
      toast("La contraseña debe tener al menos 8 caracteres", "warn");
      return;
    }
    const fortaleza = calcularFortaleza(password);
    if (fortaleza.nivel === "debil") {
      toast("La contraseña es muy débil. Usa letras y números.", "warn");
      return;
    }
    if (login.includes(" ")) {
      toast("El usuario no puede tener espacios", "warn");
      return;
    }

    const btn = box.querySelector("#v-guardar");
    btn.disabled = true;
    btn.textContent = "Creando cuenta...";

    try {
      await crearVendedorCompleto({ nombre, login, password, telefono, cartera });
      toast("¡Vendedor creado con éxito!", "ok");
      closeModal();
      pintarLista(root);
    } catch (e) {
      console.error(e);
      // Traducir errores comunes de Firebase
      let msg = "Error al crear el vendedor";
      if (e.code === "auth/email-already-in-use")
        msg = "Ese usuario ya existe. Usa otro nombre de usuario.";
      else if (e.code === "auth/weak-password")
        msg = "La contraseña es muy débil (mínimo 6 caracteres)";
      else if (e.code === "auth/invalid-email")
        msg = "El usuario tiene caracteres no válidos";
      else if (e.code === "auth/network-request-failed")
        msg = "Sin conexión a internet";
      else if (e.message) msg = e.message;
      toast(msg, "err");
      btn.disabled = false;
      btn.textContent = "Crear vendedor";
    }
  });
}

/* ---------------- DIÁLOGO: EDITAR VENDEDOR ---------------- */
function dialogoEditar(root, v) {
  const box = openModal(`
    <h2>Editar vendedor</h2>
    <div class="field">
      <label>Nombre completo *</label>
      <input type="text" id="v-nombre" value="${attr(v.nombre)}">
    </div>
    <div class="field">
      <label>Usuario / login</label>
      <input type="text" id="v-login" value="${attr(v.login)}"
             autocapitalize="none" disabled
             style="background:var(--line);color:var(--txt2)">
      <div class="muted" style="font-size:11px;margin-top:4px">
        El usuario no se puede cambiar después de crear la cuenta.
      </div>
    </div>
    <div class="field">
      <label>Teléfono</label>
      <input type="tel" id="v-telefono" value="${attr(v.telefono)}" inputmode="tel">
    </div>
    <div class="field">
      <label>Cartera asignada</label>
      <input type="number" id="v-cartera" value="${v.cartera ?? 0}" inputmode="decimal">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="v-cancel">Cancelar</button>
      <button class="btn btn-primary" id="v-guardar">Guardar cambios</button>
    </div>
  `);

  box.querySelector("#v-cancel").addEventListener("click", closeModal);
  box.querySelector("#v-guardar").addEventListener("click", async () => {
    const nombre = box.querySelector("#v-nombre").value.trim();
    const telefono = box.querySelector("#v-telefono").value.trim();
    const cartera = parseFloat(box.querySelector("#v-cartera").value) || 0;

    if (!nombre) {
      toast("El nombre es obligatorio", "warn");
      return;
    }

    const btn = box.querySelector("#v-guardar");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      // El login no cambia (se mantiene el original)
      await editarVendedor(v.id, { nombre, login: v.login, telefono, cartera });
      toast("Vendedor actualizado", "ok");
      closeModal();
      pintarLista(root);
    } catch (e) {
      console.error(e);
      toast("Error al guardar", "err");
      btn.disabled = false;
      btn.textContent = "Guardar cambios";
    }
  });
}

function attr(v) {
  return String(v ?? "").replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------------
   calcularFortaleza(password)
   Evalúa la fortaleza de una contraseña.
   Niveles:
     - debil:  solo letras o solo números, o menos de 8 caracteres
     - media:  letras + números, 8 o más caracteres
     - alta:   letras + números + caracteres especiales, 8+
   --------------------------------------------------------------- */
function calcularFortaleza(password) {
  const tieneLetras  = /[a-zA-Z]/.test(password);
  const tieneNumeros = /[0-9]/.test(password);
  const tieneEspeciales = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
  const largo = password.length;

  if (largo < 8 || (!tieneLetras && !tieneNumeros)) {
    return {
      nivel: "debil",
      porcentaje: 25,
      color: "#E53935",
      texto: "Débil",
      tip: "Usa al menos 8 caracteres combinando letras y números"
    };
  }
  if (tieneLetras && tieneNumeros && tieneEspeciales && largo >= 8) {
    return {
      nivel: "alta",
      porcentaje: 100,
      color: "#43A047",
      texto: "Alta ✓",
      tip: "Excelente contraseña"
    };
  }
  if (tieneLetras && tieneNumeros) {
    return {
      nivel: "media",
      porcentaje: 65,
      color: "#FB8C00",
      texto: "Media",
      tip: "Agrega caracteres especiales (!@#$%) para hacerla más segura"
    };
  }
  return {
    nivel: "debil",
    porcentaje: 25,
    color: "#E53935",
    texto: "Débil",
    tip: "Combina letras y números"
  };
}

/* Función global para el indicador de fortaleza (llamada desde oninput) */
window._checkPass = function(valor) {
  const cont = document.getElementById("pass-strength");
  const barra = document.getElementById("pass-barra");
  const texto = document.getElementById("pass-texto");
  const tip   = document.getElementById("pass-tip");
  if (!cont) return;

  if (!valor) {
    cont.style.display = "none";
    return;
  }
  cont.style.display = "block";
  const f = calcularFortaleza(valor);
  barra.style.width = f.porcentaje + "%";
  barra.style.background = f.color;
  texto.textContent = "Contraseña " + f.texto;
  texto.style.color = f.color;
  tip.textContent = f.tip;
};

/* ---------------------------------------------------------------
   dialogoSeguridad(root, vendedor)
   El gerente puede ver y cambiar la contraseña y el login
   de un vendedor.
--------------------------------------------------------------- */
async function dialogoSeguridad(root, v) {
  const { openModal, closeModal } = await import("../ui.js");

  const passwordActual = v.password_visible || "(no disponible)";

  const box = openModal(`
    <h2>🔑 Seguridad de ${esc(v.nombre)}</h2>
    <p class="muted" style="font-size:13px;margin-bottom:16px">
      Solo el gerente puede cambiar estos datos.
    </p>

    <!-- VER CONTRASEÑA ACTUAL -->
    <div class="card" style="background:#F3F4F6;margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:6px">
        CONTRASEÑA ACTUAL
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="seg-pass-txt" style="font-family:monospace;font-size:15px;flex:1">
          ••••••••
        </span>
        <button id="seg-ojo" style="background:none;border:none;cursor:pointer;font-size:18px">👁</button>
      </div>
    </div>

    <!-- CAMBIAR CONTRASEÑA -->
    <div class="field">
      <label>Nueva contraseña</label>
      <input type="text" id="seg-nueva-pass" placeholder="Mínimo 8 caracteres"
             oninput="window._checkPass(this.value)" autocomplete="off" />
      <div id="pass-strength" style="margin-top:6px;display:none">
        <div style="height:6px;border-radius:100px;background:var(--line);overflow:hidden">
          <div id="pass-barra" style="height:100%;width:0%;transition:width .3s;border-radius:100px"></div>
        </div>
        <div id="pass-texto" style="font-size:11px;margin-top:4px;font-weight:700"></div>
      </div>
    </div>
    <button class="btn btn-primary btn-block mb-14" id="seg-cambiar-pass">
      Cambiar contraseña
    </button>

    <div class="divider"></div>

    <!-- CAMBIAR LOGIN -->
    <div class="field">
      <label>Nombre de usuario (login actual: ${esc(v.login || "—")})</label>
      <input type="text" id="seg-nuevo-login" placeholder="Nuevo usuario"
             value="${esc(v.login || "")}" autocapitalize="none" />
    </div>
    <button class="btn btn-yellow btn-block mb-14" id="seg-cambiar-login">
      Cambiar usuario
    </button>

    <button class="btn btn-ghost btn-block" id="seg-cerrar">Cerrar</button>
  `);

  // Ojo para mostrar/ocultar la contraseña actual
  let mostrando = false;
  box.querySelector("#seg-ojo").addEventListener("click", () => {
    mostrando = !mostrando;
    box.querySelector("#seg-pass-txt").textContent =
      mostrando ? passwordActual : "••••••••";
    box.querySelector("#seg-ojo").textContent = mostrando ? "🙈" : "👁";
  });

  box.querySelector("#seg-cerrar").addEventListener("click", closeModal);

  // Cambiar contraseña
  box.querySelector("#seg-cambiar-pass").addEventListener("click", async () => {
    const nuevaPass = box.querySelector("#seg-nueva-pass").value.trim();
    if (nuevaPass.length < 8) {
      toast("La contraseña debe tener al menos 8 caracteres", "warn");
      return;
    }
    const btn = box.querySelector("#seg-cambiar-pass");
    btn.disabled = true;
    btn.textContent = "Cambiando...";
    try {
      await cambiarPasswordVendedor(v.id, nuevaPass);
      toast("Contraseña actualizada", "ok");
      closeModal();
      pintarLista(root);
    } catch (e) {
      console.error(e);
      toast("Error: " + (e.message || "No se pudo cambiar"), "err");
      btn.disabled = false;
      btn.textContent = "Cambiar contraseña";
    }
  });

  // Cambiar login
  box.querySelector("#seg-cambiar-login").addEventListener("click", async () => {
    const nuevoLogin = box.querySelector("#seg-nuevo-login").value.trim();
    if (!nuevoLogin) {
      toast("Escribe el nuevo nombre de usuario", "warn");
      return;
    }
    const btn = box.querySelector("#seg-cambiar-login");
    btn.disabled = true;
    btn.textContent = "Cambiando...";
    try {
      await cambiarLoginVendedor(v.id, nuevoLogin, v.password_visible || "");
      toast("Usuario actualizado", "ok");
      closeModal();
      pintarLista(root);
    } catch (e) {
      console.error(e);
      toast("Error: " + (e.message || "No se pudo cambiar"), "err");
      btn.disabled = false;
      btn.textContent = "Cambiar usuario";
    }
  });
}

/* ============================================================
   DIÁLOGO DE COLONIAS ASIGNADAS AL VENDEDOR
   ============================================================ */
async function dialogoColonias(root, v) {
  const { openModal, closeModal, toast } = await import("../ui.js");

  // Cargar colonias actuales del vendedor
  const coloniasActuales = await getColoniasVendedor(v.id);
  const seleccionadas = new Set(coloniasActuales);
  const grupos = coloniasPorZona();

  const zonaColors = {
    "Centro":    "#1565C0",
    "Norte":     "#2E7D32",
    "Sur":       "#E65100",
    "Oriente":   "#6A1B9A",
    "Poniente":  "#00838F",
    "Periferia": "#546E7A"
  };

  const htmlGrupos = Object.entries(grupos).map(([zona, cols]) => `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:10px;height:10px;border-radius:50%;
                    background:${zonaColors[zona] || "#999"}"></div>
        <div style="font-weight:800;font-size:13px;color:${zonaColors[zona] || "#999"}">
          ${zona}
        </div>
        <button class="btn-sel-zona" data-zona="${zona}"
                style="background:none;border:1px solid ${zonaColors[zona]};
                       color:${zonaColors[zona]};border-radius:6px;
                       padding:2px 8px;font-size:10px;cursor:pointer;font-weight:700">
          Seleccionar todo
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${cols.map(c => `
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                         background:var(--bg2,#f8f8f8);border-radius:10px;padding:8px 10px;
                         border:2px solid ${seleccionadas.has(c.id) ? zonaColors[zona]||"#1565C0" : "transparent"};
                         transition:border-color .15s" id="lbl-${c.id}">
            <input type="checkbox" id="col-${c.id}" value="${c.id}"
                   ${seleccionadas.has(c.id) ? "checked" : ""}
                   style="width:16px;height:16px;accent-color:${zonaColors[zona]||"#1565C0"};flex-shrink:0" />
            <span style="font-size:12px;font-weight:600;line-height:1.3">
              ${c.nombre}
            </span>
          </label>`).join("")}
      </div>
    </div>`).join("");

  const box = openModal(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0277BD,#29B6F6);
                  color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;
                  flex-shrink:0">🗺️</div>
      <div>
        <h2 style="margin:0;font-size:17px">Zona de ${esc(v.nombre)}</h2>
        <div style="font-size:12px;color:var(--txt2)">
          Selecciona las colonias donde puede vender y cobrar
        </div>
      </div>
    </div>

    <div style="background:#E3F2FD;border-radius:10px;padding:8px 12px;
                font-size:12px;color:#1565C0;margin-bottom:14px">
      ⚠️ Si no seleccionas ninguna colonia, el vendedor puede registrar clientes en toda la ciudad.
    </div>

    <!-- Buscador de colonias -->
    <div style="position:relative;margin-bottom:14px">
      <input type="text" id="buscar-colonia" placeholder="Buscar colonia..."
             style="width:100%;padding:10px 14px 10px 36px;border:1px solid var(--line);
                    border-radius:10px;font-size:13px;box-sizing:border-box" />
      <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
                  width:16px;height:16px;color:#aaa" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    </div>

    <!-- Contador -->
    <div style="font-size:12px;color:var(--txt2);margin-bottom:12px" id="contador-col">
      ${seleccionadas.size} colonia${seleccionadas.size !== 1 ? "s" : ""} seleccionada${seleccionadas.size !== 1 ? "s" : ""}
    </div>

    <!-- Grupos de colonias -->
    <div id="grupos-colonias" style="max-height:55vh;overflow-y:auto;padding-right:4px">
      ${htmlGrupos}
    </div>

    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-ghost" id="btn-limpiar-colonias" style="flex:1">
        🗑️ Quitar todas
      </button>
      <button class="btn btn-primary" id="btn-guardar-colonias" style="flex:2;font-weight:800">
        ✓ Guardar zona
      </button>
    </div>
    <button class="btn btn-ghost btn-block" id="colonias-cerrar" style="margin-top:8px">
      Cancelar
    </button>
  `);

  function actualizarContador() {
    const total = box.querySelectorAll("input[type=checkbox]:checked").length;
    box.querySelector("#contador-col").textContent =
      `${total} colonia${total !== 1 ? "s" : ""} seleccionada${total !== 1 ? "s" : ""}`;
  }

  // Efecto visual al hacer check
  box.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const lbl = box.querySelector(`#lbl-${cb.value}`);
      const zona = COLONIAS_COMITAN.find(c => c.id === cb.value)?.zona || "Centro";
      if (lbl) lbl.style.borderColor = cb.checked ? (zonaColors[zona] || "#1565C0") : "transparent";
      actualizarContador();
    });
  });

  // Seleccionar toda una zona
  box.querySelectorAll(".btn-sel-zona").forEach(btn => {
    btn.addEventListener("click", () => {
      const zona = btn.dataset.zona;
      const cols = grupos[zona] || [];
      const todosCheck = cols.every(c => box.querySelector(`#col-${c.id}`)?.checked);
      cols.forEach(c => {
        const cb = box.querySelector(`#col-${c.id}`);
        const lbl = box.querySelector(`#lbl-${c.id}`);
        if (cb) { cb.checked = !todosCheck; }
        if (lbl) lbl.style.borderColor = !todosCheck ? (zonaColors[zona] || "#1565C0") : "transparent";
      });
      btn.textContent = todosCheck ? "Seleccionar todo" : "Quitar todo";
      actualizarContador();
    });
  });

  // Buscador
  box.querySelector("#buscar-colonia").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    box.querySelectorAll("label[id^='lbl-']").forEach(lbl => {
      const nombre = lbl.querySelector("span")?.textContent?.toLowerCase() || "";
      lbl.style.display = nombre.includes(q) ? "" : "none";
    });
  });

  // Quitar todas
  box.querySelector("#btn-limpiar-colonias").addEventListener("click", () => {
    box.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.checked = false;
      const lbl = box.querySelector(`#lbl-${cb.value}`);
      if (lbl) lbl.style.borderColor = "transparent";
    });
    actualizarContador();
  });

  box.querySelector("#colonias-cerrar").addEventListener("click", closeModal);

  // Guardar
  box.querySelector("#btn-guardar-colonias").addEventListener("click", async () => {
    const nuevas = [...box.querySelectorAll("input[type=checkbox]:checked")]
      .map(cb => cb.value);
    const btn = box.querySelector("#btn-guardar-colonias");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      await actualizarColoniasVendedor(v.id, nuevas);
      toast(nuevas.length > 0
        ? `${nuevas.length} colonias asignadas a ${v.nombre}`
        : `${v.nombre} puede vender en toda la ciudad`, "ok");
      closeModal();
    } catch (e) {
      toast("Error: " + (e.message || ""), "err");
      btn.disabled = false;
      btn.textContent = "✓ Guardar zona";
    }
  });
}


/* ============================================================
   DIÁLOGO DE PERMISOS DEL VENDEDOR
   ============================================================ */
async function dialogoPermisos(root, v) {
  const { openModal, closeModal, toast } = await import("../ui.js");
  const { actualizarPermisos } = await import("../data.js");

  const perms = v.permisos || {
    inventario: false, editarPrecios: false,
    venderCredito: true, venderContado: true
  };
  const chk = (val) => val ? "checked" : "";

  const box = openModal(`
    <h2>🔓 Permisos — ${esc(v.nombre)}</h2>
    <p class="muted" style="font-size:13px;margin-bottom:16px">
      Los permisos desactivados no aparecen en la pantalla del vendedor.
    </p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
        <input type="checkbox" id="perm-inventario" ${chk(perms.inventario)}
               style="width:20px;height:20px;accent-color:var(--azul)" />
        <div>
          <div style="font-weight:700">📦 Gestionar inventario</div>
          <div class="muted" style="font-size:12px">Puede crear y editar productos</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
        <input type="checkbox" id="perm-precios" ${chk(perms.editarPrecios)}
               style="width:20px;height:20px;accent-color:var(--azul)" />
        <div>
          <div style="font-weight:700">💲 Editar precios</div>
          <div class="muted" style="font-size:12px">Puede modificar el precio de venta</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
        <input type="checkbox" id="perm-credito" ${chk(perms.venderCredito)}
               style="width:20px;height:20px;accent-color:var(--azul)" />
        <div>
          <div style="font-weight:700">📋 Vender a crédito</div>
          <div class="muted" style="font-size:12px">Puede registrar ventas a crédito</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
        <input type="checkbox" id="perm-contado" ${chk(perms.venderContado)}
               style="width:20px;height:20px;accent-color:var(--azul)" />
        <div>
          <div style="font-weight:700">💵 Vender al contado</div>
          <div class="muted" style="font-size:12px">Puede registrar ventas al contado</div>
        </div>
      </label>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:20px" id="btn-guardar-perms">
      Guardar permisos
    </button>
    <button class="btn btn-ghost btn-block" id="perms-cerrar" style="margin-top:8px">
      Cancelar
    </button>`);

  box.querySelector("#perms-cerrar").addEventListener("click", closeModal);
  box.querySelector("#btn-guardar-perms").addEventListener("click", async () => {
    const nuevos = {
      inventario:    box.querySelector("#perm-inventario").checked,
      editarPrecios: box.querySelector("#perm-precios").checked,
      venderCredito: box.querySelector("#perm-credito").checked,
      venderContado: box.querySelector("#perm-contado").checked
    };
    const btn = box.querySelector("#btn-guardar-perms");
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      await actualizarPermisos(v.id, nuevos);
      toast("Permisos actualizados", "ok");
      closeModal();
    } catch (e) {
      toast("Error: " + (e.message || ""), "err");
      btn.disabled = false; btn.textContent = "Guardar permisos";
    }
  });
}
