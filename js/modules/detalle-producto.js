/* ============================================================
   modules/detalle-producto.js · Detalle de producto
   ------------------------------------------------------------
   ARREGLOS:
   - Valida el STOCK: no deja agregar más unidades de las que hay.
   - Considera lo que ya está en el carrito de ese producto.
   ============================================================ */

import { agregarAlCarrito, obtenerCarrito } from "../carrito.js";
import { money, esc, toast } from "../ui.js";
import { navega, volver } from "../router.js";

let cantidad = 1;

export async function render(root, params) {
  const p = params.producto;

  if (!p) {
    toast("Error al cargar el producto", "err");
    volver();
    return;
  }

  cantidad = 1;

  // Stock disponible del producto
  const stock = Number(p.stock) || 0;

  // ¿Cuántas unidades de este producto ya hay en el carrito?
  const enCarrito = obtenerCarrito().find((it) => it.id === p.id);
  const yaEnCarrito = enCarrito ? enCarrito.cantidad : 0;

  // Lo máximo que se puede agregar ahora
  const maxAgregable = Math.max(0, stock - yaEnCarrito);

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-atras">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Detalle</h1>
    </div>

    <img class="detail-img" src="${esc(p.imagen) || placeholderImg()}"
         onerror="this.src='${placeholderImg()}'" alt="${esc(p.nombre)}">

    <div class="detail-body">
      ${p.categoria ? `<span class="badge entregado" style="margin-bottom:10px">${esc(p.categoria)}</span>` : ""}

      <h2 style="font-size:20px;font-weight:800;letter-spacing:-.4px;line-height:1.25">${esc(p.nombre)}</h2>

      <div class="detail-price-block">
        <span class="p-price">${money(p.precio)}</span>
        <span class="p-old">${money((p.precio || 0) * 1.25)}</span>
      </div>

      <span class="p-tag" style="display:inline-block;background:var(--amarillo);color:#1A1A1A;font-size:11px;font-weight:800;padding:5px 12px;border-radius:100px;text-transform:uppercase;letter-spacing:.3px">
        Hasta 12 meses
      </span>

      <!-- Indicador de stock -->
      <div style="margin-top:12px">
        ${stock > 0
          ? `<span style="font-size:13px;color:${stock <= 3 ? "var(--naranja)" : "var(--verde)"};font-weight:700">
               ${stock <= 3 ? "⚠️ ¡Últimas unidades!" : "✓ Disponible"} · ${stock} en stock
             </span>`
          : `<span style="font-size:13px;color:var(--rojo);font-weight:700">
               ✕ Agotado
             </span>`}
        ${yaEnCarrito > 0
          ? `<div style="font-size:12px;color:var(--txt2);margin-top:2px">
               Ya tienes ${yaEnCarrito} en el carrito
             </div>`
          : ""}
      </div>

      <div class="divider"></div>

      <p style="font-size:14px;color:var(--txt2);line-height:1.5">
        ${esc(p.descripcion) || "Sin descripción."}
      </p>

      <div class="divider"></div>

      <div class="row-between">
        <strong style="font-size:15px">Cantidad</strong>
        <div class="qty-row">
          <div class="qty-btn" id="btn-menos">−</div>
          <div class="qty-val" id="qty-val">1</div>
          <div class="qty-btn" id="btn-mas">+</div>
        </div>
      </div>
    </div>

    <div class="fixed-bottom-action">
      <button class="btn btn-ghost" id="btn-ver-carrito" style="flex:1">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
        </svg>
      </button>
      <button class="btn btn-buy" id="btn-agregar" style="flex:2.5">
        ${maxAgregable > 0 ? "Añadir al carrito" : "Sin stock disponible"}
      </button>
    </div>
  `;

  const qtyVal = root.querySelector("#qty-val");
  const btnAgregar = root.querySelector("#btn-agregar");

  // Si no hay stock disponible, deshabilitar el botón de agregar
  if (maxAgregable <= 0) {
    btnAgregar.disabled = true;
  }

  root.querySelector("#btn-atras").addEventListener("click", volver);

  root.querySelector("#btn-menos").addEventListener("click", () => {
    if (cantidad > 1) { cantidad--; qtyVal.textContent = cantidad; }
  });

  root.querySelector("#btn-mas").addEventListener("click", () => {
    // *** VALIDACIÓN DE STOCK ***
    if (cantidad >= maxAgregable) {
      if (maxAgregable <= 0) {
        toast("No hay stock disponible", "warn");
      } else {
        toast(`Solo puedes agregar ${maxAgregable} (stock disponible)`, "warn");
      }
      return;
    }
    cantidad++;
    qtyVal.textContent = cantidad;
  });

  root.querySelector("#btn-ver-carrito").addEventListener("click", () => {
    navega("carrito");
  });

  root.querySelector("#btn-agregar").addEventListener("click", () => {
    // *** VALIDACIÓN DE STOCK al agregar ***
    if (maxAgregable <= 0) {
      toast("Este producto está agotado", "err");
      return;
    }
    if (cantidad > maxAgregable) {
      toast(`Solo hay ${maxAgregable} unidades disponibles`, "err");
      return;
    }

    agregarAlCarrito(p, cantidad);
    toast(`¡${p.nombre} añadido!`, "ok");
    navega("inicio");
  });
}

function placeholderImg() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' fill='%23999' font-size='18' text-anchor='middle' dy='.3em'%3ESin imagen%3C/text%3E%3C/svg%3E";
}
