/* ============================================================
   modules/ofertas.js · Gestión de ofertas del día
   Solo accesible para el gerente.
   ============================================================ */

import {
  getProductos, getCategorias,
  activarOfertaProducto, desactivarOfertaProducto,
  activarOfertaCategoria, desactivarOfertaCategoria,
  precioConDescuento
} from "../data.js";
import { money, esc, toast, confirmDialog } from "../ui.js";
import { volver } from "../router.js";

export async function render(root) {
  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>🔥 Ofertas del día</h1>
    </div>
    <div class="screen-pad">
      <div class="tab-row" style="margin-bottom:16px">
        <button class="tab-btn active" id="tab-productos">Por producto</button>
        <button class="tab-btn" id="tab-categoria">Por categoría</button>
      </div>
      <div id="oferta-content">
        <div class="skeleton-list"></div>
      </div>
    </div>`;

  root.querySelector("#btn-back").addEventListener("click", volver);

  const tabs = {
    productos: root.querySelector("#tab-productos"),
    categoria: root.querySelector("#tab-categoria")
  };
  const content = root.querySelector("#oferta-content");

  let modo = "productos";
  const render = async () => {
    if (modo === "productos") await renderProductos(content);
    else await renderCategorias(content);
  };

  tabs.productos.addEventListener("click", () => {
    modo = "productos";
    tabs.productos.classList.add("active");
    tabs.categoria.classList.remove("active");
    render();
  });
  tabs.categoria.addEventListener("click", () => {
    modo = "categoria";
    tabs.categoria.classList.add("active");
    tabs.productos.classList.remove("active");
    render();
  });

  await render();
}

/* ─── Tab Productos ─────────────────────────────── */
async function renderProductos(container) {
  container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--txt2)">Cargando...</div>`;
  const productos = await getProductos();
  const sorted = [...productos].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  container.innerHTML = `
    <div class="field" style="margin-bottom:12px">
      <input type="text" id="buscar-oferta" placeholder="🔍 Buscar producto..." />
    </div>
    <div id="lista-ofertas-prod">
      ${sorted.map((p) => tarjetaProducto(p)).join("")}
    </div>`;

  container.querySelector("#buscar-oferta").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    container.querySelectorAll(".oferta-row").forEach((row) => {
      row.style.display = row.dataset.nombre.toLowerCase().includes(q) ? "" : "none";
    });
  });

  container.querySelectorAll(".btn-toggle-oferta").forEach((btn) => {
    btn.addEventListener("click", () => handleToggleProducto(btn, sorted, container));
  });
}

function tarjetaProducto(p) {
  const enOferta = p.en_oferta && p.descuento > 0;
  const precioFinal = enOferta ? precioConDescuento(p.precio, p.descuento) : p.precio;
  return `
    <div class="oferta-row card" data-id="${p.id}" data-nombre="${esc(p.nombre)}"
         style="margin-bottom:8px;display:flex;align-items:center;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(p.nombre)}
        </div>
        <div style="font-size:12px;color:var(--txt2)">
          Precio: ${money(p.precio)}
          ${enOferta ? `→ <strong style="color:#E53935">${money(precioFinal)}</strong> (-${p.descuento}%)` : ""}
        </div>
      </div>
      ${enOferta
        ? `<button class="btn btn-sm btn-red btn-toggle-oferta" data-id="${p.id}" data-activo="1">
             Quitar
           </button>`
        : `<button class="btn btn-sm btn-primary btn-toggle-oferta" data-id="${p.id}" data-activo="0">
             + Oferta
           </button>`}
    </div>`;
}

async function handleToggleProducto(btn, productos, container) {
  const id = btn.dataset.id;
  const activo = btn.dataset.activo === "1";
  const prod = productos.find((p) => p.id === id);

  if (activo) {
    // Quitar oferta
    const ok = await confirmDialog("Quitar oferta", `¿Quitar el descuento de "${prod?.nombre}"?`, "Quitar", "btn-red");
    if (!ok) return;
    btn.disabled = true;
    await desactivarOfertaProducto(id);
    toast("Oferta quitada", "ok");
    await renderProductos(container);
  } else {
    // Poner oferta — pedir porcentaje
    const pct = await pedirPorcentaje(prod?.nombre || "");
    if (!pct) return;
    btn.disabled = true;
    await activarOfertaProducto(id, pct);
    toast(`Oferta del ${pct}% activada`, "ok");
    await renderProductos(container);
  }
}

/* ─── Tab Categorías ────────────────────────────── */
async function renderCategorias(container) {
  container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--txt2)">Cargando...</div>`;
  const [productos, categorias] = await Promise.all([getProductos(), getCategorias()]);

  // Agrupar por categoría y detectar si tienen oferta activa
  const cats = {};
  productos.forEach((p) => {
    const cat = p.categoria || "Sin categoría";
    if (!cats[cat]) cats[cat] = { total: 0, enOferta: 0, descuento: 0 };
    cats[cat].total++;
    if (p.en_oferta && p.descuento > 0) {
      cats[cat].enOferta++;
      cats[cat].descuento = p.descuento;
    }
  });

  const catNames = Object.keys(cats).sort();

  container.innerHTML = catNames.map((cat) => {
    const info = cats[cat];
    const todoEnOferta = info.enOferta === info.total;
    const algunoEnOferta = info.enOferta > 0 && !todoEnOferta;
    return `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="flex:1">
            <div style="font-weight:700">${esc(cat)}</div>
            <div style="font-size:12px;color:var(--txt2)">
              ${info.total} producto${info.total > 1 ? "s" : ""}
              ${todoEnOferta
                ? `· <strong style="color:#E53935">🔥 Todos en oferta (-${info.descuento}%)</strong>`
                : algunoEnOferta
                  ? `· <span style="color:#F57C00">⚠️ ${info.enOferta} en oferta</span>`
                  : "· Sin oferta"}
            </div>
          </div>
          ${todoEnOferta || algunoEnOferta
            ? `<button class="btn btn-sm btn-red btn-cat-quitar" data-cat="${esc(cat)}">Quitar todo</button>`
            : ""}
          <button class="btn btn-sm btn-primary btn-cat-oferta" data-cat="${esc(cat)}">
            ${todoEnOferta ? "Cambiar %" : "+ Oferta"}
          </button>
        </div>
      </div>`;
  }).join("") || `<div style="text-align:center;padding:30px;color:var(--txt2)">No hay categorías</div>`;

  container.querySelectorAll(".btn-cat-oferta").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cat = btn.dataset.cat;
      const pct = await pedirPorcentaje(`categoría ${cat}`);
      if (!pct) return;
      btn.disabled = true;
      await activarOfertaCategoria(cat, pct);
      toast(`Oferta del ${pct}% aplicada a ${cat}`, "ok");
      await renderCategorias(container);
    });
  });

  container.querySelectorAll(".btn-cat-quitar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cat = btn.dataset.cat;
      const ok = await confirmDialog("Quitar ofertas", `¿Quitar todos los descuentos de la categoría "${cat}"?`, "Quitar", "btn-red");
      if (!ok) return;
      btn.disabled = true;
      await desactivarOfertaCategoria(cat);
      toast(`Ofertas de ${cat} quitadas`, "ok");
      await renderCategorias(container);
    });
  });
}

/* ─── Helper: pedir porcentaje en un mini-modal ──── */
async function pedirPorcentaje(nombre) {
  const { openModal, closeModal } = await import("../ui.js");
  return new Promise((resolve) => {
    const box = openModal(`
      <h2>🔥 Activar oferta</h2>
      <p class="muted" style="font-size:13px;margin-bottom:14px">${esc(nombre)}</p>
      <div class="field">
        <label>Porcentaje de descuento (%)</label>
        <input type="number" id="pct-input" inputmode="numeric"
               min="1" max="90" placeholder="Ej. 20" style="font-size:20px;text-align:center" />
      </div>
      <button class="btn btn-primary btn-block mb-8" id="btn-ok-pct">Aplicar</button>
      <button class="btn btn-ghost btn-block" id="btn-cancel-pct">Cancelar</button>`);

    box.querySelector("#btn-cancel-pct").addEventListener("click", () => { closeModal(); resolve(null); });
    box.querySelector("#btn-ok-pct").addEventListener("click", () => {
      const val = parseInt(box.querySelector("#pct-input").value);
      if (!val || val < 1 || val > 90) {
        toast("Ingresa un % entre 1 y 90", "warn");
        return;
      }
      closeModal();
      resolve(val);
    });
  });
}
