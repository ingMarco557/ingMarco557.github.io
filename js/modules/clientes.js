/* ============================================================
   modules/clientes.js · Lista de clientes activos
   AMPLIADO (Fase A): buscador por nombre/dirección
   ============================================================ */

import { getClientesActivos } from "../data.js";
import { getPerfil } from "../auth.js";
import { money, esc, skeletonList, toast } from "../ui.js";
import { navega } from "../router.js";

let todosClientes = [];
let filtroTexto = "";

export async function render(root) {
  root.innerHTML = `
    <div class="topbar">
      <h1>Clientes activos</h1>
    </div>

    <div class="search-bar">
      <svg class="search-ico" viewBox="0 0 24 24" width="18" height="18"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="edt-busqueda" placeholder="Buscar por nombre, colonia..."/>
    </div>

    <div class="screen-pad" id="lista-clientes" style="padding-top:6px">
      ${skeletonList(5)}
    </div>
  `;

  // Buscador
  root.querySelector("#edt-busqueda").addEventListener("input", (e) => {
    filtroTexto = e.target.value.toLowerCase().trim();
    pintarLista(root);
  });

  try {
    const perfil = await getPerfil();
    if (!perfil) {
      toast("Sesión caducada", "err");
      return;
    }
    todosClientes = await getClientesActivos(perfil.uid, perfil.rol);
    pintarLista(root);
  } catch (e) {
    console.error(e);
    root.querySelector("#lista-clientes").innerHTML = `
      <div class="empty-state">
        <div class="es-icon" style="font-size:40px">⚠</div>Error al obtener clientes
      </div>`;
  }
}

function pintarLista(root) {
  const cont = root.querySelector("#lista-clientes");

  // Filtrar
  let lista = todosClientes;
  if (filtroTexto) {
    lista = lista.filter((c) => {
      const buscar =
        `${c.nombre || ""} ${c.apePat || ""} ${c.apeMat || ""} ${c.colonia || ""} ${c.direccion_completa || ""} ${c.producto || ""}`.toLowerCase();
      return buscar.includes(filtroTexto);
    });
  }

  if (!todosClientes || todosClientes.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="es-icon" style="font-size:40px">👤</div>No hay clientes activos todavía
      </div>`;
    return;
  }

  if (lista.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        Sin resultados que coincidan
      </div>`;
    return;
  }

  // Header con contador
  const headerHTML = filtroTexto
    ? `<div class="muted" style="font-size:12px;margin-bottom:10px;padding:0 4px">
         ${lista.length} de ${todosClientes.length} clientes
       </div>`
    : `<div class="muted" style="font-size:12px;margin-bottom:10px;padding:0 4px">
         ${todosClientes.length} ${todosClientes.length === 1 ? "cliente activo" : "clientes activos"}
       </div>`;

  cont.innerHTML =
    headerHTML +
    lista
      .map((c) => {
        const nombreCompleto = `${c.nombre || ""} ${c.apePat || ""}`.trim();
        return `
      <div class="list-item" data-id="${c.id}">
        <img class="li-avatar" src="${esc(c.foto_rostro) || avatarPh()}"
             onerror="this.src='${avatarPh()}'">
        <div class="li-body">
          <div class="li-name">${esc(nombreCompleto)}</div>
          ${
            c.estatus_mora === "Moroso"
              ? `
            <span style="background:#C62828;color:#fff;font-size:10px;font-weight:700;
                         padding:2px 8px;border-radius:100px;margin-top:2px;display:inline-block">
              ⚠️ MOROSO +${money(c.recargo || 0)} recargo
            </span>`
              : ""
          }
          <div class="li-sub">${esc(c.colonia || c.direccion_completa || "")}</div>
          <div class="li-amount">Saldo: ${money(c.saldo)}</div>
        </div>
        <div style="font-size:20px;color:var(--txt2)">›</div>
      </div>
    `;
      })
      .join("");

  cont.querySelectorAll(".list-item").forEach((item) => {
    item.addEventListener("click", () => {
      const cliente = todosClientes.find((c) => c.id === item.dataset.id);
      navega("detalle-cobro", { cliente });
    });
  });
}

function avatarPh() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='54'%3E%3Crect width='54' height='54' fill='%23bdbdbd'/%3E%3Ctext x='50%25' y='50%25' fill='%23fff' font-size='24' text-anchor='middle' dy='.35em'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
}
