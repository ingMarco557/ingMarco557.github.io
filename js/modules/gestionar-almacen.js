/* ============================================================
   modules/gestionar-almacen.js · Gestión del almacén (solo Gerente)
   Equivale a GestionarAlmacenActivity.kt + ProductoAlmacenAdapter.kt
   - Lista de productos con su precio de venta y stock
   - Crear / Editar / Eliminar productos
   - Calcula el precio de venta en tiempo real según el costo
   - Sube la foto del producto a Firebase Storage
   ============================================================ */

import {
  getProductosAlmacen, crearProducto, editarProducto,
  eliminarProducto, calcularPrecioVenta
} from "../data.js";
import { subirImagen } from "../storage.js";
import { money, esc, toast, confirmDialog, skeletonList } from "../ui.js";
import { volver } from "../router.js";

/* Categorías fijas — las mismas que tenías en tu app Android */
const CATEGORIAS = [
  "Bases", "Bocinas", "Camas", "Centrifugadoras", "Cilindros",
  "Closets", "Colchones Individuales", "Colchones Matrimoniales",
  "Colchones King Size", "Colchonetas", "Compensadores", "Congeladores",
  "Dispensadores", "Enfriadores", "Estufas", "Frigobar",
  "Libreros", "Licuadoras", "Mesas", "Microondas",
  "Mini Componentes", "Mini Split", "Muebles para TV", "Parrillas",
  "Planchas", "Recámaras", "Refrigeradores", "Reguladores",
  "Salas", "Televisores", "Ventiladores"
];

let vista = "lista"; // "lista" | "formulario"
let modoEdicion = false;
let productoEditando = null;
let fotoFile = null; // File de la nueva imagen

export async function render(root) {
  vista = "lista";
  await pintarLista(root);
}

/* ---------------- VISTA LISTA ---------------- */
async function pintarLista(root) {
  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">←</button>
      <h1>Gestionar Almacén</h1>
    </div>
    <div class="screen-pad" id="cont-productos">
      ${skeletonList(4)}
    </div>
    <button class="fab" id="fab-nuevo">+</button>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);
  root.querySelector("#fab-nuevo").addEventListener("click", () => {
    abrirFormulario(root, null);
  });

  try {
    const productos = await getProductosAlmacen();
    const cont = root.querySelector("#cont-productos");

    if (productos.length === 0) {
      cont.innerHTML = `<div class="empty-state">
        <div class="es-icon">🏬</div>No hay productos en el inventario.<br>
        Toca + para agregar uno.</div>`;
      return;
    }

    cont.innerHTML = `<div class="product-grid" style="padding:0">
      ${productos.map((p) => `
        <div class="product-card">
          <img class="p-img" src="${esc(p.imagen) || ph()}"
               onerror="this.src='${ph()}'">
          <div class="p-body">
            <div class="p-name">${esc(p.nombre)}</div>
            <div class="p-price">${money(p.precio)}</div>
            <div class="muted" style="font-size:12px">Stock: ${p.stock ?? 0}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-sm btn-ghost" data-editar="${p.id}" style="flex:1">✏️</button>
              <button class="btn btn-sm btn-red" data-eliminar="${p.id}" style="flex:1">🗑️</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>`;

    // Listeners de editar
    cont.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => {
        const prod = productos.find((p) => p.id === b.dataset.editar);
        abrirFormulario(root, prod);
      }));

    // Listeners de eliminar
    cont.querySelectorAll("[data-eliminar]").forEach((b) =>
      b.addEventListener("click", async () => {
        const prod = productos.find((p) => p.id === b.dataset.eliminar);
        const ok = await confirmDialog("🗑️ Eliminar producto",
          `¿Eliminar "${prod.nombre}" del inventario?`, "Eliminar", "btn-red");
        if (!ok) return;
        try {
          await eliminarProducto(prod.id);
          toast("Producto eliminado", "ok");
          pintarLista(root);
        } catch (e) {
          console.error(e);
          toast("No se pudo eliminar", "err");
        }
      }));

  } catch (e) {
    console.error(e);
    root.querySelector("#cont-productos").innerHTML =
      `<div class="empty-state"><div class="es-icon">⚠️</div>Error al cargar productos</div>`;
  }
}

/* ---------------- VISTA FORMULARIO ---------------- */
function abrirFormulario(root, producto) {
  modoEdicion = !!producto;
  productoEditando = producto;
  fotoFile = null;

  // En edición mostramos el COSTO (no el precio de venta), igual que en Android
  const costoInicial = producto ? (producto.costo ?? "") : "";

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back-form">←</button>
      <h1>${modoEdicion ? "Editar producto" : "Nuevo producto"}</h1>
    </div>

    <div class="screen-pad">
      <div class="photo-slot">
        <img id="img-prod" class="${producto?.imagen ? "" : "hidden"}"
             src="${esc(producto?.imagen) || ""}">
        <div class="ph-placeholder ${producto?.imagen ? "hidden" : ""}" id="ph-prod">
          <div style="font-size:36px">📷</div>
          <div class="muted" style="font-size:13px">Foto del producto</div>
        </div>
        <input type="file" id="file-prod" accept="image/*">
        <button class="btn btn-ghost btn-sm" id="btn-foto">Elegir foto</button>
      </div>

      <div class="field">
        <label>Nombre del producto *</label>
        <input type="text" id="f-nombre" value="${esc(producto?.nombre || "")}">
      </div>

      <div class="field">
        <label>Categoría *</label>
        <select id="f-categoria">
          <option value="">Selecciona...</option>
          ${CATEGORIAS.map((c) =>
            `<option value="${c}" ${producto?.categoria === c ? "selected" : ""}>${c}</option>`
          ).join("")}
        </select>
      </div>

      <div class="field">
        <label>Descripción</label>
        <textarea id="f-desc" rows="3">${esc(producto?.descripcion || "")}</textarea>
      </div>

      <div class="field">
        <label>Costo (lo que pagó el gerente) *</label>
        <input type="number" id="f-costo" inputmode="decimal" value="${costoInicial}">
      </div>

      <!-- Tarjeta de precio calculado en tiempo real -->
      <div class="card ${costoInicial ? "" : "hidden"}" id="card-calculado"
           style="background:#E3F2FD">
        <div class="sim-row">
          <span>Precio de venta calculado</span>
          <strong class="sim-total" id="tv-precio-calc">$0</strong>
        </div>
        <div class="sim-row">
          <span>Margen aplicado</span>
          <strong id="tv-margen">—</strong>
        </div>
      </div>

      <div class="field">
        <label>Stock (unidades) *</label>
        <input type="number" id="f-stock" inputmode="numeric" value="${producto?.stock ?? ""}">
      </div>

      <button class="btn btn-primary btn-block" id="btn-guardar">
        ${modoEdicion ? "Guardar cambios" : "Subir a inventario"}
      </button>
    </div>
  `;

  root.querySelector("#btn-back-form").addEventListener("click", () => pintarLista(root));

  // Selector de foto
  const fileInput = root.querySelector("#file-prod");
  root.querySelector("#btn-foto").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    fotoFile = f;
    const img = root.querySelector("#img-prod");
    img.src = URL.createObjectURL(f);
    img.classList.remove("hidden");
    root.querySelector("#ph-prod").classList.add("hidden");
  });

  // Cálculo de precio en tiempo real al escribir el costo
  const inputCosto = root.querySelector("#f-costo");
  inputCosto.addEventListener("input", () => {
    const costo = parseFloat(inputCosto.value);
    const card = root.querySelector("#card-calculado");
    if (costo > 0) {
      const precio = calcularPrecioVenta(costo);
      let margen;
      if (costo < 2000) margen = "200%";
      else if (costo < 10000) margen = "125%";
      else margen = "40%";
      root.querySelector("#tv-precio-calc").textContent = money(precio);
      root.querySelector("#tv-margen").textContent = margen;
      card.classList.remove("hidden");
    } else {
      card.classList.add("hidden");
    }
  });
  // Disparar el cálculo si venimos en modo edición
  if (costoInicial) inputCosto.dispatchEvent(new Event("input"));

  // Guardar
  root.querySelector("#btn-guardar").addEventListener("click", () => guardar(root));
}

/* Guarda el producto (crear o editar) */
async function guardar(root) {
  const nombre = root.querySelector("#f-nombre").value.trim();
  const categoria = root.querySelector("#f-categoria").value.trim();
  const descripcion = root.querySelector("#f-desc").value.trim();
  const costo = parseFloat(root.querySelector("#f-costo").value) || 0;
  const stock = parseInt(root.querySelector("#f-stock").value, 10) || 0;

  if (!nombre || !categoria || costo <= 0) {
    toast("Nombre, categoría y costo son obligatorios", "warn");
    return;
  }

  const btn = root.querySelector("#btn-guardar");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    // Subir imagen si hay una nueva
    let imagenUrl = null;
    if (fotoFile) {
      btn.textContent = "Subiendo foto...";
      imagenUrl = await subirImagen(fotoFile, "productos");
    }

    if (modoEdicion) {
      await editarProducto(productoEditando.id, {
        nombre, categoria, descripcion, costo, stock, imagenUrl
      });
      toast("Producto actualizado", "ok");
    } else {
      await crearProducto({
        nombre, categoria, descripcion, costo, stock, imagenUrl
      });
      toast("Producto guardado", "ok");
    }
    pintarLista(root);

  } catch (e) {
    console.error(e);
    toast("Error al guardar: " + (e.message || ""), "err");
    btn.disabled = false;
    btn.textContent = modoEdicion ? "Guardar cambios" : "Subir a inventario";
  }
}

function ph() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='130'%3E%3Crect width='200' height='130' fill='%23e0e0e0'/%3E%3C/svg%3E";
}
