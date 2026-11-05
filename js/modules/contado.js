/* ============================================================
   modules/contado.js · Venta al contado
   ------------------------------------------------------------
   Flujo:
   1. El carrito ya tiene productos seleccionados.
   2. El vendedor ve el total.
   3. Escribe cuánto le da el cliente.
   4. La app calcula el cambio.
   5. Se registra la venta, se descuenta el stock.
   6. Se genera el ticket en PDF.
   ============================================================ */

import { obtenerCarrito, limpiarCarrito, calcularTotal } from "../carrito.js";
import { money, esc, toast, confirmDialog } from "../ui.js";
import { volver, navega } from "../router.js";
import { getPerfil } from "../auth.js";
import { registrarVentaContado } from "../data.js";

export async function render(root) {
  const carrito = obtenerCarrito();
  const total = calcularTotal();

  if (carrito.length === 0) {
    toast("El carrito está vacío", "warn");
    volver();
    return;
  }

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Pago al contado</h1>
    </div>

    <div class="screen-pad">
      <!-- RESUMEN DE PRODUCTOS -->
      <div class="card">
        <div class="card-title">🛒 Productos</div>
        ${carrito.map((it) => `
          <div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--line)">
            <div>
              <div style="font-weight:600;font-size:14px">${esc(it.nombre)}</div>
              <div class="muted" style="font-size:12px">×${it.cantidad}</div>
            </div>
            <strong>${money(it.precio * it.cantidad)}</strong>
          </div>
        `).join("")}
        <div class="row-between" style="margin-top:10px">
          <span style="font-weight:700">Total</span>
          <strong style="color:var(--azul);font-size:18px">${money(total)}</strong>
        </div>
      </div>

      <!-- MONTO RECIBIDO -->
      <div class="card">
        <div class="card-title">📱 Teléfono del cliente (para enviar ticket)</div>
        <div class="field" style="margin-bottom:0">
          <input type="tel" id="et-telefono" inputmode="numeric"
                 placeholder="10 dígitos (opcional)" maxlength="10" />
        </div>
      </div>

      <div class="card">
        <div class="card-title">💵 Monto recibido del cliente</div>
        <div class="field" style="margin-bottom:0">
          <input type="number" id="et-monto" inputmode="decimal"
                 placeholder="0.00" style="font-size:20px;text-align:center" />
        </div>
      </div>

      <!-- CAMBIO -->
      <div class="card" id="card-cambio" style="background:#E8F5E9;border-color:#A5D6A7;display:none">
        <div class="card-title" style="color:var(--verde)">💚 Cambio a entregar</div>
        <div id="txt-cambio" style="font-size:28px;font-weight:900;color:var(--verde);text-align:center">
          $0.00
        </div>
      </div>

      <div class="card" id="card-insuficiente" style="background:#FFEBEE;border-color:#EF9A9A;display:none">
        <div style="color:#C62828;font-weight:700;text-align:center">
          ⚠️ El monto es insuficiente para cubrir el total
        </div>
      </div>

      <button class="btn btn-green btn-block" id="btn-cobrar" disabled>
        Confirmar cobro y generar ticket
      </button>
    </div>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);

  const etMonto = root.querySelector("#et-monto");
  const cardCambio = root.querySelector("#card-cambio");
  const cardInsuf = root.querySelector("#card-insuficiente");
  const txtCambio = root.querySelector("#txt-cambio");
  const btnCobrar = root.querySelector("#btn-cobrar");

  etMonto.addEventListener("input", () => {
    const monto = parseFloat(etMonto.value) || 0;
    if (monto <= 0) {
      cardCambio.style.display = "none";
      cardInsuf.style.display = "none";
      btnCobrar.disabled = true;
      return;
    }
    if (monto < total) {
      cardCambio.style.display = "none";
      cardInsuf.style.display = "block";
      btnCobrar.disabled = true;
    } else {
      cardInsuf.style.display = "none";
      cardCambio.style.display = "block";
      txtCambio.textContent = money(monto - total);
      btnCobrar.disabled = false;
    }
  });

  btnCobrar.addEventListener("click", async () => {
    const monto = parseFloat(etMonto.value) || 0;
    const telefono = root.querySelector("#et-telefono")?.value.trim() || "";
    if (monto < total) return;

    const ok = await confirmDialog(
      "💵 Confirmar cobro",
      `Total: ${money(total)}\nRecibido: ${money(monto)}\nCambio: ${money(monto - total)}\n\n¿Confirmar la venta?`,
      "Confirmar", "btn-green");
    if (!ok) return;

    btnCobrar.disabled = true;
    btnCobrar.textContent = "Procesando...";

    try {
      const perfil = await getPerfil();
      const resultado = await registrarVentaContado({
        items: carrito.map((it) => ({
          id: it.id, nombre: it.nombre,
          cantidad: it.cantidad, precio: it.precio
        })),
        totalVenta: total,
        montoPagado: monto,
        cvUsuario: perfil?.uid || "",
        nombreVendedor: perfil?.nombre || ""
      });

      toast("¡Venta registrada!", "ok");

      if (resultado.sinStock && resultado.sinStock.length > 0) {
        toast(`Advertencia: sin stock suficiente para: ${resultado.sinStock.map((s) => s.nombre).join(", ")}`, "warn");
      }

      // Generar ticket PDF
      await generarTicketContado(carrito, total, monto, resultado.cambio, perfil, telefono);

      limpiarCarrito();
      navega("inicio");

    } catch (e) {
      console.error(e);
      toast("Error: " + (e.message || "No se pudo completar la venta"), "err");
      btnCobrar.disabled = false;
      btnCobrar.textContent = "Confirmar cobro y generar ticket";
    }
  });
}

/* Genera el ticket de venta al contado en PDF */
async function generarTicketContado(carrito, total, montoPagado, cambio, perfil, telefono = "") {
  try {
    // Cargar jsPDF
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const { LOGO_MUEBLIMEX } = await import("../logo-data.js");

    // Encabezado
    try { doc.addImage(LOGO_MUEBLIMEX, "JPEG", 80, 10, 50, 47); } catch (_) {}
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Máxima calidad en mueblería · Desde 1989", 105, 62, { align: "center" });
    doc.setDrawColor(240, 180, 30);
    doc.setLineWidth(1);
    doc.line(20, 72, 190, 72);
    doc.setFontSize(14);
    doc.setTextColor(21, 101, 192);
    doc.setFont("helvetica", "bold");
    doc.text("TICKET DE VENTA AL CONTADO", 105, 83, { align: "center" });

    let y = 95;
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Fecha: ${new Date().toLocaleString("es-MX")}`, 25, y);
    y += 12;

    // Productos
    doc.setFontSize(11);
    doc.setTextColor(21, 101, 192);
    doc.setFont("helvetica", "bold");
    doc.text("Productos", 25, y); y += 8;

    carrito.forEach((it) => {
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.text(`${it.nombre} ×${it.cantidad}`, 25, y);
      doc.text(money(it.precio * it.cantidad), 185, y, { align: "right" });
      y += 7;
    });

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(25, y, 185, y);
    y += 7;

    // Totales
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 101, 192);
    doc.text("Total", 25, y);
    doc.text(money(total), 185, y, { align: "right" });
    y += 8;

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.text("Recibido", 25, y);
    doc.text(money(montoPagado), 185, y, { align: "right" });
    y += 7;

    doc.setTextColor(46, 125, 50);
    doc.setFont("helvetica", "bold");
    doc.text("Cambio", 25, y);
    doc.text(money(cambio), 185, y, { align: "right" });
    y += 12;

    // Vendedor
    if (perfil?.nombre) {
      doc.setTextColor(90, 90, 90);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Atendido por: ${perfil.nombre}`, 25, y);
      y += 10;
    }

    // Pie
    doc.setDrawColor(240, 180, 30);
    doc.line(20, y, 190, y);
    y += 7;
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text("¡Gracias por su compra! Mueblimex - Máxima calidad en mueblería.", 105, y, { align: "center" });

    // Compartir o descargar
    const blob = doc.output("blob");
    const archivo = new File([blob], `Ticket_Contado_${Date.now()}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: "Ticket Mueblimex" });
    } else {
      doc.save(`Ticket_Contado_${Date.now()}.pdf`);
    }
  } catch (e) {
    console.warn("No se pudo generar el ticket PDF:", e);
  }
}
