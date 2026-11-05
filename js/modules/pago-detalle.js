/* ============================================================
   modules/pago-detalle.js · Registrar un pago / abono
   Equivale a PagoDetalleActivity.kt + activity_pago_detalle.xml
   - Muestra saldo pendiente y monto recomendado
   - El vendedor escribe cuánto abona el cliente
   - Registra el pago en Firestore (descuenta saldo)
   ============================================================ */

import { registrarPagoDinamico } from "../data.js";
import { money, esc, toast } from "../ui.js";
import { volver } from "../router.js";

export async function render(root, params) {
  const c = params.cliente;
  if (!c) { volver(); return; }

  const saldoPendiente = c.saldo || 0;
  const recomendado = params.montoSugerido || saldoPendiente;
  const nombre = `${c.nombre || ""} ${c.apePat || ""}`.trim();

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">←</button>
      <h1>Registrar pago</h1>
    </div>

    <div class="screen-pad">
      <div class="card">
        <div class="card-title">Productos del crédito</div>
        ${Array.isArray(c.items) && c.items.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
            ${c.items.map((it, i) => `
              <div style="display:flex;align-items:center;gap:10px;
                          padding:8px 10px;background:var(--bg2,#f8f8f8);
                          border-radius:10px;border-left:3px solid var(--azul)">
                <div style="background:var(--azul);color:#fff;width:24px;height:24px;
                             border-radius:50%;display:flex;align-items:center;
                             justify-content:center;font-size:11px;font-weight:800;
                             flex-shrink:0">${i + 1}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:13px;white-space:nowrap;
                               overflow:hidden;text-overflow:ellipsis">${esc(it.nombre || "—")}</div>
                  <div style="font-size:11px;color:var(--txt2)">
                    ×${it.cantidad || 1}
                    ${it.precio ? ` · ${money(it.precio * (it.cantidad || 1))}` : ""}
                  </div>
                </div>
              </div>`).join("")}
          </div>
        ` : `
          <div style="font-weight:700;margin-bottom:8px">${esc(c.producto || "Producto")}</div>
        `}
        <p class="muted">${esc(nombre)}</p>
        <div class="divider"></div>
        <div class="sim-row">
          <span>Saldo pendiente</span>
          <strong class="sim-total">${money(saldoPendiente)}</strong>
        </div>
        <div class="sim-row">
          <span>Monto recomendado</span>
          <strong style="color:var(--verde)">${money(recomendado)}</strong>
        </div>
      </div>

      <div class="card">
        <div class="field" style="margin-bottom:0">
          <label>Cantidad a pagar</label>
          <input type="number" id="et-cantidad" inputmode="decimal"
                 value="${recomendado.toFixed(2)}" />
        </div>
        <p class="muted mt-8" style="font-size:12px">
          Si el cliente paga más del saldo, se ajustará automáticamente
          para liquidar el crédito.
        </p>
      </div>

      <button class="btn btn-green btn-block" id="btn-confirmar">
        Confirmar pago
      </button>
    </div>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);

  root.querySelector("#btn-confirmar").addEventListener("click", async () => {
    const input = root.querySelector("#et-cantidad");
    let monto = parseFloat(input.value) || 0;

    if (monto <= 0) {
      toast("Ingresa una cantidad válida", "warn");
      return;
    }
    // Si intenta pagar más de lo que debe, lo ajustamos al saldo (liquidación)
    if (monto > saldoPendiente) {
      monto = saldoPendiente;
    }

    const btn = root.querySelector("#btn-confirmar");
    btn.disabled = true;
    btn.textContent = "Procesando...";

    try {
      const res = await registrarPagoDinamico(c.id, monto);

      const liquidado = res.nuevoSaldo <= 0;
      if (liquidado) {
        toast("¡Pago exitoso! Crédito liquidado 🎉", "ok");
      } else {
        toast(`Pago registrado. Saldo: ${money(res.nuevoSaldo)}`, "ok");
      }

      // Ofrecer recibo con TODOS los productos del crédito
      try {
        const { generarReciboPago, compartirPDF } = await import("../recibos.js");

        // Calcular datos del recibo
        const pagosHechos   = (c.total_pagos || 1) - Math.max(0, (res.pagosFaltantes ?? (c.pagos_faltantes || 0)) - 1);
        const pagosTotales  = c.total_pagos || 1;
        const proximoPago   = res.proximaFecha || "";

        const { doc, nombreArchivo } = await generarReciboPago({
          nombreCliente:   nombre,
          telefonoCliente: c.telefono || c.whatsapp || "",
          montoPagado:     monto,
          totalCredito:    c.total_venta || 0,
          saldoAnterior:   saldoPendiente,
          saldoNuevo:      res.nuevoSaldo,
          pagosHechos,
          pagosTotales,
          proximoPago,
          nombreVendedor:  c.nombre_vendedor || "",
          // Pasar TODOS los productos
          items:           Array.isArray(c.items) && c.items.length > 0 ? c.items : null,
          producto:        c.producto || ""
        });

        await compartirPDF(doc, nombreArchivo,
          `Recibo de pago de ${nombre} - ${money(monto)} - Mueblimex`);
      } catch (errPDF) {
        console.warn("No se pudo generar el recibo:", errPDF);
      }

      volver();
    } catch (e) {
      console.error(e);
      toast("Error al procesar el pago", "err");
      btn.disabled = false;
      btn.textContent = "Confirmar pago";
    }
  });
}
