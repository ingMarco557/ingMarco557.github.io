/* ============================================================
   modules/detalle-cobro.js · Detalle de cobro
   ------------------------------------------------------------
   - Historial completo de pagos
   - Botón "Editar datos del cliente"
   - *** Vencimiento REAL calculado (fecha del próximo pago,
       estado con color, días restantes) ***
   ============================================================ */

import { getPagosCredito, getDetalleCredito } from "../data.js";
import { calcularVencimiento, formatearFecha } from "../vencimientos.js";
import { getPerfil } from "../auth.js";
import { money, esc, toast, skeletonList } from "../ui.js";
import { navega, volver } from "../router.js";

export async function render(root, params) {
  let c = params.cliente;
  if (!c) {
    volver();
    return;
  }

  try {
    const fresco = await getDetalleCredito(c.id);
    if (fresco) c = fresco;
  } catch (_) {
    /* ignorar */
  }

  const perfil = await getPerfil();
  const esGerente = perfil && String(perfil.rol).toLowerCase() === "gerente";
  const esDueño = perfil && c.cv_usuario === perfil.uid;
  const puedeEditar = esGerente || esDueño;

  const nombre = `${c.nombre || ""} ${c.apePat || ""}`.trim();
  const totalPagos = c.total_pagos || 1;
  const faltantes = c.pagos_faltantes || 0;
  const montoSugerido =
    faltantes > 0 ? (c.saldo || 0) / faltantes : c.saldo || 0;

  // *** Cálculo REAL del vencimiento ***
  const venc = calcularVencimiento(c);

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Detalle de cobro</h1>
      ${
        puedeEditar
          ? `
        <button class="topbar-action" id="btn-editar" aria-label="Editar cliente">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      `
          : ""
      }
    </div>

    <div class="screen-pad">
      <div class="card text-center">
        <img src="${esc(c.foto_rostro) || avatarPh()}"
             onerror="this.src='${avatarPh()}'"
             style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 8px">
        <h2 style="font-size:18px">${esc(nombre)}</h2>
        <div class="li-sub">📍 ${esc(c.colonia || "")}</div>
        <div class="li-sub">${esc(c.direccion_completa || "")}</div>
        ${c.telefono_cliente ? `<div class="li-sub">📞 ${esc(c.telefono_cliente)}</div>` : ""}
      </div>

      <!-- TARJETA DE VENCIMIENTO (con color según estado) -->
      <div class="card" style="${estiloVencimiento(venc.color)}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:13px;font-weight:700;opacity:.85">Próximo pago</div>
            <div style="font-size:16px;font-weight:900;margin-top:2px">
              ${venc.proximaFecha ? formatearFecha(venc.proximaFecha) : "—"}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:900">
              ${venc.diasRestantes !== null ? venc.diasRestantes : "—"}
            </div>
            <div style="font-size:11px;opacity:.85">
              ${venc.diasRestantes !== null ? "días" : ""}
            </div>
          </div>
        </div>
        <div style="margin-top:8px;font-size:13px;font-weight:700">
          ${venc.etiqueta}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Estado del crédito</div>
        <div class="sim-row"><span>Producto</span>
          <strong>${esc(c.producto || "—")}</strong></div>
        ${
          Array.isArray(c.items) && c.items.length > 1
            ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">
            <div style="font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:6px">TODOS LOS PRODUCTOS</div>
            ${c.items
              .map(
                (it) => `
              <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">
                <span>${esc(it.nombre)} ×${it.cantidad}</span>
                <span style="font-weight:600">${money(it.precio * it.cantidad)}</span>
              </div>`,
              )
              .join("")}
          </div>`
            : ""
        }
        <div class="sim-row"><span>Total del crédito</span>
          <strong>${money(c.total_venta)}</strong></div>
        <div class="sim-row"><span>Saldo pendiente</span>
          <strong class="sim-total">${money(c.saldo)}</strong></div>
        <div class="sim-row"><span>Pagos realizados</span>
          <strong>${venc.pagosHechos} / ${venc.pagosTotales}</strong></div>
        <div class="sim-row"><span>Frecuencia</span>
          <strong>${esc(c.frecuencia || "Mensual")}</strong></div>
        <div class="divider"></div>
        <div class="sim-row">
          <span>Monto sugerido este periodo</span>
          <strong style="color:var(--verde)">${money(montoSugerido)}</strong>
        </div>
      </div>

      ${
        (c.saldo || 0) > 0
          ? `
        <button class="btn btn-green btn-block mb-8" id="btn-pago">
          💵 Realizar pago
        </button>
      `
          : `
        <div class="card text-center" style="background:#E8F5E9;border-color:#A5D6A7">
          <div style="font-size:32px">✅</div>
          <strong style="color:var(--verde);font-size:16px">Crédito liquidado</strong>
        </div>
      `
      }

      <!-- HISTORIAL DE PAGOS -->
      <div class="card">
        <div class="card-title">📋 Historial de pagos</div>
        <div id="cont-historial">
          ${skeletonList(2)}
        </div>
      </div>
    </div>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);

  const btnEditar = root.querySelector("#btn-editar");
  if (btnEditar) {
    btnEditar.addEventListener("click", () => {
      navega("editar-cliente", { cliente: c });
    });
  }

  const btnPago = root.querySelector("#btn-pago");
  if (btnPago) {
    btnPago.addEventListener("click", () => {
      navega("pago-detalle", { cliente: c, montoSugerido });
    });
  }

  cargarHistorial(root, c.id, esGerente, c);
}

/* Estilo de la tarjeta de vencimiento según el color del estado */
function estiloVencimiento(color) {
  const estilos = {
    rojo: "background:#FFEBEE;border-color:#EF9A9A;color:#C62828",
    amarillo: "background:#FFF8E1;border-color:#FFE082;color:#F57F17",
    verde: "background:#E8F5E9;border-color:#A5D6A7;color:#2E7D32",
    azul: "background:#E3F2FD;border-color:#90CAF9;color:#1565C0",
  };
  return estilos[color] || estilos.verde;
}

async function cargarHistorial(root, creditoId, esGerente, credito = null) {
  const cont = root.querySelector("#cont-historial");
  try {
    const pagos = await getPagosCredito(creditoId); // usa caché 2 min
    if (pagos.length === 0) {
      cont.innerHTML = `
        <div style="text-align:center;padding:20px 0;color:var(--txt2);font-size:13px">
          Aún no se han registrado pagos
        </div>`;
      return;
    }

    const totalCobrado = pagos.reduce(
      (acc, p) => acc + (p.monto_pagado || 0),
      0,
    );

    cont.innerHTML = `
      <div style="background:var(--azul-claro);padding:12px 14px;border-radius:var(--r-md);margin-bottom:12px">
        <div class="row-between">
          <span style="font-size:13px;font-weight:600">Total cobrado</span>
          <strong style="color:var(--azul);font-size:16px">${money(totalCobrado)}</strong>
        </div>
        <div class="muted" style="font-size:11px;margin-top:2px">
          ${pagos.length} ${pagos.length === 1 ? "pago registrado" : "pagos registrados"}
        </div>
      </div>

      ${pagos
        .map(
          (p, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;
                    ${i < pagos.length - 1 ? "border-bottom:1px solid var(--line)" : ""}">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--verde);color:#fff;
                      display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">
            ${pagos.length - i}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px">${money(p.monto_pagado)}</div>
            <div class="muted" style="font-size:12px">${formatearFechaPago(p.fecha)}</div>
            ${p.corregido ? `<div style="font-size:10px;color:var(--naranja)">✏️ Pago corregido</div>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
            <button class="btn-recibo-pago"
                    data-pago="${p.id}"
                    data-monto="${p.monto_pagado}"
                    data-fecha="${p.fecha && p.fecha.seconds ? p.fecha.seconds : 0}"
                    style="background:var(--azul);color:#fff;border-radius:8px;
                           padding:6px 10px;font-size:11px;cursor:pointer;
                           display:flex;align-items:center;gap:4px;font-weight:600;
                           border:none">
              📄 Recibo
            </button>
            ${
              esGerente
                ? `<button class="btn-corregir-pago" data-pago="${p.id}" data-monto="${p.monto_pagado}"
                   style="background:none;border:1px solid var(--line);border-radius:8px;
                          padding:6px 10px;font-size:12px;cursor:pointer;color:var(--txt2)">
                   ⚙️
                 </button>`
                : `<div style="color:var(--verde);font-size:20px">✓</div>`
            }
          </div>
        </div>
      `,
        )
        .join("")}
    `;

    // TODOS: delegación de eventos para botón de recibo
    cont.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-recibo-pago");
      if (!btn) return;

      const pagoId = btn.dataset.pago;
      const monto = parseFloat(btn.dataset.monto) || 0;
      const fechaSecs = parseInt(btn.dataset.fecha) || 0;
      const fechaPago = fechaSecs
        ? new Date(fechaSecs * 1000).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "—";

      btn.disabled = true;
      btn.textContent = "⏳";

      try {
        const { generarReciboIndividual } = await import("../recibos.js");
        const creditoData = credito || {};
        await generarReciboIndividual({
          credito: creditoData,
          montoPagado: monto,
          fechaPago,
          pagoId,
          vendedor: creditoData.nombre_vendedor || "",
        });
      } catch (e) {
        const { toast } = await import("../ui.js");
        toast("No se pudo generar el recibo: " + (e.message || ""), "err");
        console.error("Error recibo:", e);
      } finally {
        btn.disabled = false;
        btn.textContent = "📄 Recibo";
      }
    });

    // Solo el gerente: botones para corregir/cancelar pagos
    if (esGerente) {
      cont.querySelectorAll(".btn-corregir-pago").forEach((btn) => {
        btn.addEventListener("click", () => {
          dialogoCorregirPago(
            root,
            creditoId,
            btn.dataset.pago,
            parseFloat(btn.dataset.monto),
            esGerente,
          );
        });
      });
    }
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<div class="muted text-center" style="padding:14px 0;font-size:13px">
      No se pudo cargar el historial
    </div>`;
  }
}

/* Diálogo para que el GERENTE corrija o cancele un pago */
async function dialogoCorregirPago(
  root,
  creditoId,
  pagoId,
  montoActual,
  esGerente,
) {
  const { openModal, closeModal } = await import("../ui.js");
  const { corregirPago, cancelarPago } = await import("../data.js");

  const box = openModal(`
    <h2>⚙️ Corregir pago</h2>
    <p class="muted" style="font-size:13px;margin-bottom:14px">
      Monto registrado actualmente: <strong>${money(montoActual)}</strong>
    </p>

    <div class="field">
      <label>Monto correcto</label>
      <input type="number" id="cp-monto" inputmode="decimal"
             value="${montoActual.toFixed(2)}" />
    </div>
    <p class="muted" style="font-size:11px;margin-bottom:14px">
      El saldo del crédito se reajustará automáticamente.
    </p>

    <button class="btn btn-primary btn-block mb-8" id="cp-guardar">
      Guardar corrección
    </button>
    <button class="btn btn-red btn-block mb-8" id="cp-cancelar-pago">
      🗑️ Cancelar este pago por completo
    </button>
    <button class="btn btn-ghost btn-block" id="cp-cerrar">
      Cerrar
    </button>
  `);

  box.querySelector("#cp-cerrar").addEventListener("click", closeModal);

  // Guardar la corrección del monto
  box.querySelector("#cp-guardar").addEventListener("click", async () => {
    const nuevoMonto = parseFloat(box.querySelector("#cp-monto").value) || 0;
    if (nuevoMonto <= 0) {
      toast("Ingresa un monto válido", "warn");
      return;
    }
    const btn = box.querySelector("#cp-guardar");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      await corregirPago(pagoId, nuevoMonto);
      toast("Pago corregido", "ok");
      closeModal();
      cargarHistorial(root, creditoId, esGerente);
    } catch (e) {
      console.error(e);
      toast("Error: " + (e.message || ""), "err");
      btn.disabled = false;
      btn.textContent = "Guardar corrección";
    }
  });

  // Cancelar el pago por completo
  box.querySelector("#cp-cancelar-pago").addEventListener("click", async () => {
    const { confirmDialog } = await import("../ui.js");
    const ok = await confirmDialog(
      "🗑️ Cancelar pago",
      `¿Eliminar este pago de ${money(montoActual)}?\n\nEl monto se devolverá al saldo pendiente del cliente.`,
      "Eliminar pago",
      "btn-red",
    );
    if (!ok) return;
    try {
      await cancelarPago(pagoId);
      toast("Pago cancelado", "ok");
      closeModal();
      cargarHistorial(root, creditoId, esGerente);
    } catch (e) {
      console.error(e);
      toast("Error: " + (e.message || ""), "err");
    }
  });
}

function formatearFechaPago(timestamp) {
  if (!timestamp || !timestamp.seconds) return "Sin fecha";
  const fecha = new Date(timestamp.seconds * 1000);
  return fecha.toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarPh() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23bdbdbd'/%3E%3Ctext x='50%25' y='50%25' fill='%23fff' font-size='32' text-anchor='middle' dy='.35em'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
}
