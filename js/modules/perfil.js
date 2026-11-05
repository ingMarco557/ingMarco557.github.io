/* ============================================================
   modules/perfil.js · Perfil del usuario
   AMPLIADO (Fase A): botón de Dashboard solo para gerente
   ============================================================ */

import { getPerfilCompleto } from "../data.js";
import { getPerfil, logout } from "../auth.js";
import { money, esc, toast, confirmDialog } from "../ui.js";
import { navega } from "../router.js";

export async function render(root) {
  const perfilSesion = await getPerfil();
  if (!perfilSesion) { toast("Sesión caducada", "err"); return; }

  const nombre = perfilSesion.nombre || "Usuario";
  const inicial = nombre.charAt(0).toUpperCase();
  const esGerente = String(perfilSesion.rol).toLowerCase() === "gerente";

  root.innerHTML = `
    <div class="profile-head">
      <div class="profile-avatar">${esc(inicial)}</div>
      <h2 style="font-size:20px" id="p-nombre">${esc(nombre)}</h2>
      <div style="opacity:.85" id="p-rol">${esc(perfilSesion.rol || "")}</div>
    </div>

    <div class="profile-body">
      <div class="card">
        <div class="card-title">Información de la cuenta</div>
        <div class="sim-row"><span>Usuario</span>
          <strong id="p-login">—</strong></div>
        <div class="sim-row"><span>Teléfono</span>
          <strong id="p-telefono">—</strong></div>
        <div class="sim-row"><span>Cargo</span>
          <strong id="p-cargo">${esc(perfilSesion.rol || "—")}</strong></div>
      </div>

      <div class="card">
        <div class="card-title">Mi cartera</div>
        <div id="chart-cartera">${skeletonDona()}</div>
        <div class="cartera-grid mt-8">
          <div>
            <div class="cg-val" id="p-cartera">—</div>
            <div class="cg-lbl">Total</div>
          </div>
          <div>
            <div class="cg-val" style="color:var(--rojo)" id="p-usado">—</div>
            <div class="cg-lbl">Usado</div>
          </div>
          <div>
            <div class="cg-val" style="color:var(--verde)" id="p-disponible">—</div>
            <div class="cg-lbl">Disponible</div>
          </div>
        </div>
      </div>

      ${esGerente ? `
        <div class="card">
          <div class="card-title">Administración</div>
          <button class="btn btn-yellow btn-block mb-8" id="btn-dashboard">
            📊 Dashboard / Reportes
          </button>
          <button class="btn btn-primary btn-block mb-8" id="btn-almacen">
            🏬 Gestionar Almacén
          </button>
          <button class="admin-btn" id="btn-ofertas">
            🔥 Ofertas del día
          </button>
          <button class="btn btn-primary btn-block" id="btn-vendedores">
            👔 Gestionar Vendedores
          </button>
        </div>
      ` : `
        <div class="card">
          <div class="card-title">Mi rendimiento</div>
          <button class="btn btn-yellow btn-block" id="btn-dashboard-vendedor">
            📊 Ver mi dashboard
          </button>
        </div>
      `}

      <button class="btn btn-red btn-block" id="btn-logout">
        Cerrar sesión
      </button>
    </div>
  `;

  if (esGerente) {
    root.querySelector("#btn-dashboard").addEventListener("click", () =>
      navega("dashboard"));
    root.querySelector("#btn-almacen").addEventListener("click", () =>
      navega("gestionar-almacen"));
    root.querySelector("#btn-ofertas")?.addEventListener("click", () =>
      navega("ofertas"));
    root.querySelector("#btn-vendedores").addEventListener("click", () =>
      navega("gestionar-vendedores"));
  } else {
    root.querySelector("#btn-dashboard-vendedor").addEventListener("click", () =>
      navega("dashboard-vendedor"));
  }

  root.querySelector("#btn-logout").addEventListener("click", async () => {
    const ok = await confirmDialog("Cerrar sesión",
      "¿Seguro que quieres salir?", "Salir", "btn-red");
    if (!ok) return;
    await logout();
    navega("login");
  });

  try {
    const data = await getPerfilCompleto(perfilSesion.uid);
    if (data) {
      root.querySelector("#p-nombre").textContent = data.nombre_completo || nombre;
      root.querySelector("#p-rol").textContent = data.rol || "";
      root.querySelector("#p-login").textContent = data.login || "—";
      root.querySelector("#p-telefono").textContent = data.telefono || "Sin teléfono";
      root.querySelector("#p-cargo").textContent = data.rol || "—";
      root.querySelector("#p-cartera").textContent = money(data.cartera);
      root.querySelector("#p-usado").textContent = money(data.usado);
      root.querySelector("#p-disponible").textContent = money(data.disponible);

      root.querySelector("#chart-cartera").innerHTML =
        donaSVG(data.usado, data.disponible);
    }
  } catch (e) {
    console.error(e);
    toast("Error al cargar el perfil", "err");
  }
}

function donaSVG(usado, disponible) {
  const total = (usado || 0) + (disponible || 0);
  if (total <= 0) {
    return `<svg viewBox="0 0 120 120" width="100%">
      <circle cx="60" cy="60" r="48" fill="none" stroke="#e0e0e0" stroke-width="22"/>
      <text x="60" y="64" text-anchor="middle" font-size="11" fill="#999">Sin datos</text>
    </svg>`;
  }

  const r = 48;
  const circ = 2 * Math.PI * r;
  const fracUsado = usado / total;
  const lenUsado = circ * fracUsado;
  const lenDisp = circ - lenUsado;

  return `
    <svg viewBox="0 0 120 120" width="100%">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="#f0f0f0" stroke-width="22"/>
      <circle cx="60" cy="60" r="${r}" fill="none"
        stroke="#E53935" stroke-width="22"
        stroke-dasharray="${lenUsado} ${circ}"
        transform="rotate(-90 60 60)"/>
      <circle cx="60" cy="60" r="${r}" fill="none"
        stroke="#4CAF50" stroke-width="22"
        stroke-dasharray="${lenDisp} ${circ}"
        stroke-dashoffset="${-lenUsado}"
        transform="rotate(-90 60 60)"/>
      <text x="60" y="58" text-anchor="middle" font-size="12" font-weight="700" fill="#212121">
        ${Math.round(fracUsado * 100)}%
      </text>
      <text x="60" y="72" text-anchor="middle" font-size="9" fill="#757575">usado</text>
    </svg>
    <div style="display:flex;justify-content:center;gap:16px;font-size:12px;margin-top:4px">
      <span><span style="color:#E53935">●</span> Usado</span>
      <span><span style="color:#4CAF50">●</span> Disponible</span>
    </div>
  `;
}

function skeletonDona() {
  return `<svg viewBox="0 0 120 120" width="100%">
    <circle cx="60" cy="60" r="48" fill="none" stroke="#eee" stroke-width="22"/>
  </svg>`;
}
