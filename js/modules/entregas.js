/* ============================================================
   modules/entregas.js · Entregas pendientes / Solicitudes
   AÑADIDO:
   - Marca las solicitudes como "vistas" al entrar (quita el
     contador de "nuevas" y actualiza el badge de la nav).
   - Buscador (de la Fase A).
   ============================================================ */

import { getEntregas } from "../data.js";
import { cacheInvalidar } from "../cache.js";
import { getPerfil } from "../auth.js";
import { money, esc, skeletonList, toast } from "../ui.js";
import { navega } from "../router.js";
import { marcarSolicitudesVistas, actualizarBadgeNav } from "../avisos.js";

let todasEntregas = [];
let filtroTexto = "";

export async function render(root) {
  const perfil = await getPerfil();
  if (!perfil) {
    toast("Sesión caducada", "err");
    return;
  }

  const esGerente = String(perfil.rol).toLowerCase() === "gerente";
  const titulo = esGerente ? "Solicitudes pendientes" : "Entregas pendientes";

  root.innerHTML = `
    <div class="topbar">
      <h1>${titulo}</h1>
    </div>

    <div class="search-bar">
      <svg class="search-ico" viewBox="0 0 24 24" width="18" height="18"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="edt-busqueda" placeholder="Buscar por nombre, producto..."/>
    </div>

    <div class="screen-pad" id="lista-entregas" style="padding-top:6px">
      ${skeletonList(4)}
    </div>
  `;

  root.querySelector("#edt-busqueda").addEventListener("input", (e) => {
    filtroTexto = e.target.value.toLowerCase().trim();
    pintarLista(root, esGerente);
  });

  try {
    todasEntregas = await getEntregas(perfil.uid, perfil.rol);
    pintarLista(root, esGerente);

    // *** Marcar como vistas: el usuario ya entró a esta pantalla ***
    // Así dejan de contar como "nuevas" y se actualiza el badge.
    marcarSolicitudesVistas(todasEntregas.length);
    actualizarBadgeNav();
  } catch (e) {
    console.error(e);
    root.querySelector("#lista-entregas").innerHTML = `
      <div class="empty-state">
        <div class="es-icon">!</div>Error de conexión
      </div>`;
  }
}

function pintarLista(root, esGerente) {
  const cont = root.querySelector("#lista-entregas");

  let lista = todasEntregas;
  if (filtroTexto) {
    lista = lista.filter((e) => {
      const buscar =
        `${e.nombre || ""} ${e.apePat || ""} ${e.colonia || ""} ${e.producto || ""} ${e.direccion_completa || ""} ${e.nombre_vendedor || ""}`.toLowerCase();
      return buscar.includes(filtroTexto);
    });
  }

  if (!todasEntregas || todasEntregas.length === 0) {
    const msg = esGerente
      ? "No hay solicitudes pendientes"
      : "No hay entregas pendientes";
    cont.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">—</div>${msg}
      </div>`;
    return;
  }

  if (lista.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        Sin resultados
      </div>`;
    return;
  }

  const headerHTML = filtroTexto
    ? `<div class="muted" style="font-size:12px;margin-bottom:10px;padding:0 4px">
         ${lista.length} de ${todasEntregas.length}
       </div>`
    : `<div class="muted" style="font-size:12px;margin-bottom:10px;padding:0 4px">
         ${todasEntregas.length} ${todasEntregas.length === 1 ? "pendiente" : "pendientes"}
       </div>`;

  cont.innerHTML =
    headerHTML +
    lista
      .map((e) => {
        const nombre = `${e.nombre || ""} ${e.apePat || ""}`.trim();
        const estatusTxt =
          e.estatus === 1
            ? "Pendiente"
            : e.estatus === 2
              ? "Aprobado"
              : "Entregado";
        const estatusClase =
          e.estatus === 1
            ? "pendiente"
            : e.estatus === 2
              ? "aprobado"
              : "entregado";
        return `
      <div class="list-item" data-id="${e.id}">
        <div class="li-body">
          <div class="row-between">
            <div class="li-name">${esc(nombre)}</div>
            <span class="badge ${estatusClase}">${estatusTxt}</span>
          </div>
          <div class="li-sub">📍 ${esc(e.colonia || e.direccion_completa || "")}</div>
          <div class="li-sub">🛋️ ${esc(e.producto || "Sin producto")}</div>
          ${esGerente && e.nombre_vendedor ? `<div class="li-sub">👤 ${esc(e.nombre_vendedor)}</div>` : ""}
          <div class="li-amount">${money(e.total_venta)}</div>
        </div>
        <div style="font-size:20px;color:var(--txt2)">›</div>
      </div>
    `;
      })
      .join("");

  cont.querySelectorAll(".list-item").forEach((item) => {
    item.addEventListener("click", () => {
      const entrega = todasEntregas.find((e) => e.id === item.dataset.id);
      navega("detalle-entrega", { entrega });
    });
  });
}
