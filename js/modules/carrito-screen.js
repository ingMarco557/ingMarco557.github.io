/* ============================================================
   modules/carrito-screen.js · Carrito + simulador de crédito
   ------------------------------------------------------------
   ARREGLOS:
   - Valida el STOCK al aumentar cantidad de un producto.
   - El selector de PLAZO cambia según la frecuencia:
       Mensual:    3 / 6 / 12 Meses
       Quincenal:  6 / 12 / 24 Quincenas
   ============================================================ */

import {
  obtenerCarrito, cambiarCantidad, calcularTotal
} from "../carrito.js";
import { money, esc, toast } from "../ui.js";
import { navega, volver } from "../router.js";
import { getPerfil } from "../auth.js";
import { getPerfilCompleto } from "../data.js";

export async function render(root) {
  pintar(root);
}

function pintar(root) {
  const lista = obtenerCarrito();

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-volver">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Mi Carrito</h1>
    </div>

    <div class="screen-pad">
      <div id="cart-list">
        ${lista.length === 0
          ? `<div class="empty-state"><div class="es-icon">🛒</div>Tu carrito está vacío</div>`
          : lista.map((it) => itemHTML(it)).join("")}
      </div>

      ${lista.length > 0 ? simuladorHTML() : ""}
    </div>
  `;

  root.querySelector("#btn-volver").addEventListener("click", volver);

  if (lista.length === 0) return;

  // --- Botones de cantidad (+/-) con validación de stock ---
  root.querySelectorAll("[data-mas]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.mas;
      const item = lista.find((it) => it.id === id);
      const stock = Number(item?.stock) || 0;

      // *** VALIDACIÓN DE STOCK ***
      if (item && item.cantidad >= stock) {
        toast(`Solo hay ${stock} unidades de "${item.nombre}"`, "warn");
        return;
      }
      cambiarCantidad(id, +1);
      pintar(root);
    }));

  root.querySelectorAll("[data-menos]").forEach((b) =>
    b.addEventListener("click", () => {
      cambiarCantidad(b.dataset.menos, -1);
      pintar(root);
    }));

  // --- Simulador ---
  const etEnganche = root.querySelector("#et-enganche");
  const selPlazo = root.querySelector("#sel-plazo");
  const radios = root.querySelectorAll("input[name=frecuencia]");

  etEnganche.addEventListener("input", () => actualizarTotales(root));
  selPlazo.addEventListener("change", () => actualizarTotales(root));

  // Al cambiar la frecuencia, ACTUALIZAMOS las opciones del plazo
  radios.forEach((r) => r.addEventListener("change", () => {
    actualizarOpcionesPlazo(root);
    actualizarTotales(root);
  }));

  // Pintar las opciones de plazo iniciales (mensual por defecto)
  actualizarOpcionesPlazo(root);
  actualizarTotales(root);

  // --- Botón finalizar ---
  root.querySelector("#btn-finalizar").addEventListener("click", async () => {
    await procesarVenta(root);
  });
}

/* HTML de un item del carrito (muestra el stock) */
function itemHTML(it) {
  const stock = Number(it.stock) || 0;
  return `
    <div class="cart-item">
      <img class="ci-img" src="${esc(it.imagen) || placeholderImg()}"
           onerror="this.src='${placeholderImg()}'">
      <div class="ci-body">
        <div class="ci-name">${esc(it.nombre)}</div>
        <div class="ci-price">${money(it.precio)}</div>
        <div class="muted" style="font-size:11px;margin-top:2px">
          ${stock > 0 ? `Stock: ${stock}` : "Sin stock"}
        </div>
        <div class="ci-qty">
          <div class="qty-btn" data-menos="${it.id}">−</div>
          <span class="qty-val">${it.cantidad}</span>
          <div class="qty-btn" data-mas="${it.id}">+</div>
        </div>
      </div>
    </div>
  `;
}

/* HTML del simulador (el <select> de plazo se llena por JS) */
function simuladorHTML() {
  return `
    <div class="sim-box">
      <div class="card-title">Simulador de crédito</div>

      <div class="sim-row">
        <span>Total de la compra</span>
        <strong class="sim-total" id="txt-total">$0</strong>
      </div>
      <div class="sim-row" id="txt-minimo" style="font-size:13px">
        Mínimo (30%): $0
      </div>

      <div class="field mt-8">
        <label>Enganche</label>
        <input type="number" id="et-enganche" placeholder="0.00" inputmode="decimal" />
      </div>

      <div class="field">
        <label>Frecuencia de pago</label>
        <div class="radio-group">
          <label>
            <input type="radio" name="frecuencia" value="mensual" checked>
            <span>Mensual</span>
          </label>
          <label>
            <input type="radio" name="frecuencia" value="quincenal">
            <span>Quincenal</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label>Plazo</label>
        <select id="sel-plazo">
          <!-- Se llena dinámicamente según la frecuencia -->
        </select>
      </div>

      <div class="divider"></div>
      <div class="sim-row">
        <span>Tu pago será de</span>
        <strong id="txt-cuota" style="color:var(--azul)">—</strong>
      </div>

      <button class="btn btn-primary btn-block mt-16" id="btn-finalizar">
        Continuar con el registro
      </button>
    </div>
  `;
}

/* ACTUALIZA las opciones del <select> de plazo según la frecuencia.
   - Mensual:   3, 6, 12 meses
   - Quincenal: 6, 12, 24 quincenas (equivalen a los mismos meses) */
function actualizarOpcionesPlazo(root) {
  const sel = root.querySelector("#sel-plazo");
  const esQuincenal = root.querySelector("input[name=frecuencia]:checked").value === "quincenal";

  let opciones;
  if (esQuincenal) {
    // El value es el NÚMERO DE PAGOS (quincenas)
    opciones = [
      { value: 6,  texto: "6 Quincenas (3 meses)" },
      { value: 12, texto: "12 Quincenas (6 meses)" },
      { value: 24, texto: "24 Quincenas (12 meses)" }
    ];
  } else {
    // El value es el NÚMERO DE PAGOS (meses)
    opciones = [
      { value: 3,  texto: "3 Meses" },
      { value: 6,  texto: "6 Meses" },
      { value: 12, texto: "12 Meses" }
    ];
  }

  // Por defecto seleccionamos la opción de en medio (6 meses / 12 quincenas)
  sel.innerHTML = opciones.map((o, i) =>
    `<option value="${o.value}" ${i === 2 ? "selected" : ""}>${o.texto}</option>`
  ).join("");
}

/* Recalcula totales y cuota */
function actualizarTotales(root) {
  const total = calcularTotal();
  const minimo30 = total * 0.30;

  root.querySelector("#txt-total").textContent = money(total);

  const txtMin = root.querySelector("#txt-minimo");
  txtMin.textContent = `Mínimo (30%): ${money(minimo30)}`;

  const enganche = parseFloat(root.querySelector("#et-enganche").value) || 0;
  txtMin.style.color = enganche < minimo30 ? "var(--rojo)" : "var(--verde)";

  const saldoAFinanciar = total - enganche;
  const txtCuota = root.querySelector("#txt-cuota");

  if (saldoAFinanciar <= 0) {
    txtCuota.textContent = "Pagado con enganche";
    return;
  }

  // El value del <select> ya es el NÚMERO DE PAGOS directamente
  const numPagos = parseInt(root.querySelector("#sel-plazo").value, 10);
  const esQuincenal = root.querySelector("input[name=frecuencia]:checked").value === "quincenal";
  const cuota = saldoAFinanciar / numPagos;
  const frecTxt = esQuincenal ? "Quincena" : "Mes";

  txtCuota.textContent = `${money(cuota)} / ${frecTxt}`;
}

/* Procesa la venta — con validación de cartera del vendedor */
async function procesarVenta(root) {
  const lista = obtenerCarrito();
  const total = calcularTotal();
  const enganche = parseFloat(root.querySelector("#et-enganche").value) || 0;
  const minimoPermitido = total * 0.30;

  if (lista.length === 0) {
    toast("El carrito está vacío", "warn");
    return;
  }
  if (enganche < minimoPermitido) {
    toast("El enganche es insuficiente (mínimo 30%)", "err");
    return;
  }

  const creditoAFinanciar = total - enganche;

  // *** VALIDAR CARTERA DEL VENDEDOR ***
  try {
    const sesion = await getPerfil();
    if (sesion && String(sesion.rol).toLowerCase() === "vendedor") {
      const perfil = await getPerfilCompleto(sesion.uid);
      if (perfil) {
        const disponible = Math.max(0, (perfil.cartera || 0) - (perfil.usado || 0));
        if (creditoAFinanciar > disponible) {
          toast(
            `❌ Crédito supera tu cartera disponible.\n` +
            `Crédito a financiar: ${money(creditoAFinanciar)}\n` +
            `Tu cartera disponible: ${money(disponible)}\n` +
            `No puedes continuar con esta transacción.`,
            "err"
          );
          return;
        }
      }
    }
  } catch (e) {
    console.warn("No se pudo validar la cartera:", e);
    // Si falla la validación por red, dejamos continuar
  }

  const numPagos = parseInt(root.querySelector("#sel-plazo").value, 10);
  const esQuincenal = root.querySelector("input[name=frecuencia]:checked").value === "quincenal";
  const frecuencia = esQuincenal ? "Quincenal" : "Mensual";

  navega("datos-cliente", {
    total_credito: creditoAFinanciar,
    enganche,
    total_pagos: numPagos,
    frecuencia,
    productos: lista,
    producto_principal: lista[0]
  });
}

function placeholderImg() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3Crect width='70' height='70' fill='%23f0f0f0'/%3E%3C/svg%3E";
}
