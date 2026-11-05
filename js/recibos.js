/* ============================================================
   js/recibos.js · Generador de recibos PDF
   ------------------------------------------------------------
   Genera dos tipos de documento en PDF:
     1. Ticket de CONTRATO  → al crear un crédito
     2. Recibo de PAGO      → al registrar un abono

   Usa jsPDF (se carga desde CDN la primera vez).
   El PDF se puede COMPARTIR (WhatsApp, correo) usando el menú
   nativo del teléfono, o descargar si no hay opción de
   compartir.
   ============================================================ */

import { LOGO_MUEBLIMEX } from "./logo-data.js";

/* Colores de la marca Mueblimex */
const AZUL = [21, 101, 192];
const AMARILLO = [240, 180, 30];
const GRIS = [90, 90, 90];

/* Carga jsPDF desde CDN una sola vez */
let _jsPDFCargado = null;
function cargarJsPDF() {
  if (_jsPDFCargado) return _jsPDFCargado;
  _jsPDFCargado = new Promise((resolve, reject) => {
    if (window.jspdf) {
      resolve(window.jspdf);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf);
    script.onerror = () =>
      reject(new Error("No se pudo cargar el generador de PDF"));
    document.head.appendChild(script);
  });
  return _jsPDFCargado;
}

/* Formatea dinero */
function money(n) {
  return (
    "$" +
    (Number(n) || 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/* Formatea fecha */
function fechaHoy() {
  return new Date().toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------------------------------------
   ENCABEZADO común (logo + datos de la empresa)
------------------------------------------------------------ */
function dibujarEncabezado(doc, titulo) {
  // Logo (centrado arriba)
  try {
    doc.addImage(LOGO_MUEBLIMEX, "JPEG", 80, 10, 50, 47);
  } catch (e) {
    // Si falla el logo, ponemos el nombre en texto
    doc.setFontSize(22);
    doc.setTextColor(...AZUL);
    doc.setFont("helvetica", "bold");
    doc.text("MUEBLIMEX", 105, 30, { align: "center" });
  }

  // Datos de la empresa
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.text("Máxima calidad en mueblería · Desde 1989", 105, 62, {
    align: "center",
  });
  doc.text("Comitán de Domínguez, Chiapas", 105, 67, { align: "center" });

  // Línea separadora
  doc.setDrawColor(...AMARILLO);
  doc.setLineWidth(1);
  doc.line(20, 72, 190, 72);

  // Título del documento
  doc.setFontSize(15);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 105, 83, { align: "center" });
}

/* ------------------------------------------------------------
   PIE de página común
------------------------------------------------------------ */
function dibujarPie(doc, y) {
  doc.setDrawColor(...AMARILLO);
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);

  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Este documento es un comprobante de su crédito con Mueblimex.",
    105,
    y + 7,
    { align: "center" },
  );
  doc.text("Conserve este recibo para cualquier aclaración.", 105, y + 12, {
    align: "center",
  });
  doc.text(`Generado el ${fechaHoy()}`, 105, y + 17, { align: "center" });
}

/* Dibuja una fila "etiqueta : valor" */
function fila(doc, etiqueta, valor, y, opciones = {}) {
  doc.setFontSize(opciones.size || 10);
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.text(etiqueta, 25, y);

  doc.setTextColor(
    opciones.color ? opciones.color[0] : 30,
    opciones.color ? opciones.color[1] : 30,
    opciones.color ? opciones.color[2] : 30,
  );
  doc.setFont("helvetica", opciones.bold ? "bold" : "normal");
  doc.text(String(valor), 185, y, { align: "right" });
}

/* ============================================================
   1. TICKET DE CONTRATO  (al crear un crédito)
   ============================================================ */
export async function generarTicketContrato(credito) {
  const jspdf = await cargarJsPDF();
  const doc = new jspdf.jsPDF();

  dibujarEncabezado(doc, "COMPROBANTE DE CRÉDITO");

  const nombre =
    `${credito.nombre || ""} ${credito.apePat || ""} ${credito.apeMat || ""}`.trim();

  let y = 95;

  // Datos del cliente
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text("Datos del cliente", 25, y);
  y += 8;

  fila(doc, "Nombre", nombre, y);
  y += 7;
  fila(doc, "Teléfono", credito.telefono_cliente || "—", y);
  y += 7;
  fila(doc, "Dirección", "", y);
  doc.setFontSize(9);
  doc.text(recortar(credito.direccion_completa || "—", 60), 185, y, {
    align: "right",
  });
  y += 7;
  if (credito.rfc) {
    fila(doc, "RFC", credito.rfc, y);
    y += 7;
  }
  y += 4;

  // Datos del crédito
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle del crédito", 25, y);
  y += 8;

  // Lista de productos
  const items =
    Array.isArray(credito.items) && credito.items.length > 0
      ? credito.items
      : [{ nombre: credito.producto || "Producto", cantidad: 1 }];

  items.forEach((it) => {
    fila(doc, `  • ${it.nombre}`, `x${it.cantidad || 1}`, y);
    y += 6;
  });
  y += 2;

  fila(
    doc,
    "Total de la venta",
    money(credito.total_venta_original || credito.total_venta),
    y,
  );
  y += 7;
  fila(doc, "Enganche", money(credito.enganche), y);
  y += 7;
  fila(doc, "Total a crédito", money(credito.total_venta), y, {
    bold: true,
    color: AZUL,
  });
  y += 7;
  fila(doc, "Frecuencia de pago", credito.frecuencia || "Mensual", y);
  y += 7;
  fila(doc, "Número de pagos", String(credito.total_pagos || "—"), y);
  y += 7;

  const cuota =
    credito.total_pagos > 0 ? credito.total_venta / credito.total_pagos : 0;
  const frecTxt = String(credito.frecuencia).toLowerCase().includes("quincenal")
    ? "quincena"
    : "mes";
  fila(doc, `Pago por ${frecTxt}`, money(cuota), y, {
    bold: true,
    color: AZUL,
    size: 11,
  });
  y += 10;

  // Vendedor
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text("Atendido por", 25, y);
  y += 8;
  fila(doc, "Vendedor", credito.nombre_vendedor || "—", y);
  y += 7;
  fila(doc, "Fecha", fechaHoy(), y);
  y += 12;

  dibujarPie(doc, y);

  const nombreArchivo = `Contrato_${limpiarNombre(nombre)}.pdf`;
  return { doc, nombreArchivo };
}

/* ============================================================
   2. RECIBO DE PAGO  (al registrar un abono)
   ============================================================ */
export async function generarReciboPago(datos) {
  const jspdf = await cargarJsPDF();
  const doc = new jspdf.jsPDF();

  dibujarEncabezado(doc, "RECIBO DE PAGO");

  const nombre = datos.nombreCliente || "—";
  let y = 95;

  // Folio del recibo (basado en la hora, simple)
  const folio = "REC-" + Date.now().toString().slice(-8);

  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(`Folio: ${folio}`, 25, y);
  doc.text(`Fecha: ${fechaHoy()}`, 185, y, { align: "right" });
  y += 12;

  // Monto pagado - DESTACADO en un recuadro
  doc.setFillColor(232, 245, 233);
  doc.roundedRect(25, y - 6, 160, 22, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.text("Monto recibido", 105, y, { align: "center" });
  doc.setFontSize(20);
  doc.setTextColor(46, 125, 50);
  doc.setFont("helvetica", "bold");
  doc.text(money(datos.montoPagado), 105, y + 9, { align: "center" });
  y += 26;

  // Datos del cliente
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 25, y);
  y += 8;
  fila(doc, "Nombre", nombre, y);
  y += 7;
  if (datos.telefonoCliente) {
    fila(doc, "Teléfono", datos.telefonoCliente, y);
    y += 7;
  }
  y += 4;

  // Estado del crédito tras el pago
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text("Estado del crédito", 25, y);
  y += 8;
  // Mostrar TODOS los productos si hay items
  const itemsRecibo =
    Array.isArray(datos.items) && datos.items.length > 0
      ? datos.items
      : [{ nombre: datos.producto || "—", cantidad: 1 }];
  if (itemsRecibo.length === 1) {
    fila(doc, "Producto", itemsRecibo[0].nombre, y);
    y += 7;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "bold");
    doc.text("Productos:", 25, y);
    y += 5;
    itemsRecibo.forEach((it) => {
      doc.setFont("helvetica", "normal");
      const txt = `  • ${it.nombre} ×${it.cantidad || 1}`;
      doc.text(txt.length > 55 ? txt.slice(0, 52) + "..." : txt, 25, y);
      y += 5;
    });
    y += 2;
  }
  fila(doc, "Total del crédito", money(datos.totalCredito), y);
  y += 7;
  fila(doc, "Saldo anterior", money(datos.saldoAnterior), y);
  y += 7;
  fila(doc, "Pago realizado", money(datos.montoPagado), y);
  y += 7;
  fila(doc, "Saldo restante", money(datos.saldoNuevo), y, {
    bold: true,
    color: AZUL,
  });
  y += 7;
  fila(
    doc,
    "Pagos realizados",
    `${datos.pagosHechos} de ${datos.pagosTotales}`,
    y,
  );
  y += 7;

  if (datos.proximoPago) {
    fila(doc, "Próximo pago", datos.proximoPago, y);
    y += 7;
  }

  // IVA desglosado (precio YA incluye IVA 16%)
  if (datos.montoPagado > 0) {
    const baseIVA = Math.round((datos.montoPagado / 1.16) * 100) / 100;
    const ivaAmt = Math.round((datos.montoPagado - baseIVA) * 100) / 100;
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(25, y, 185, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal (base):", 25, y);
    doc.text(money(baseIVA), 185, y, { align: "right" });
    y += 5;
    doc.text("IVA (16% incluido):", 25, y);
    doc.text(money(ivaAmt), 185, y, { align: "right" });
    y += 5;
    doc.setLineWidth(0.5);
    doc.line(25, y, 185, y);
    y += 3;
  }

  if (datos.saldoNuevo <= 0) {
    y += 4;
    doc.setFillColor(232, 245, 233);
    doc.roundedRect(25, y - 5, 160, 14, 3, 3, "F");
    doc.setFontSize(12);
    doc.setTextColor(46, 125, 50);
    doc.setFont("helvetica", "bold");
    doc.text("CREDITO LIQUIDADO - PAGADO EN SU TOTALIDAD", 105, y + 4, {
      align: "center",
    });
    y += 18;
  }
  y += 6;

  // Vendedor
  doc.setFontSize(11);
  doc.setTextColor(...AZUL);
  doc.setFont("helvetica", "bold");
  doc.text("Cobrado por", 25, y);
  y += 8;
  fila(doc, "Vendedor", datos.nombreVendedor || "—", y);
  y += 12;

  dibujarPie(doc, y);

  const nombreArchivo = `Recibo_${limpiarNombre(nombre)}_${folio}.pdf`;
  return { doc, nombreArchivo };
}

/* ============================================================
   COMPARTIR / DESCARGAR el PDF
   ============================================================ */

/* Intenta compartir el PDF con el menú nativo del teléfono.
   Si no se puede compartir archivos, lo descarga. */
export async function compartirPDF(doc, nombreArchivo, textoMensaje = "") {
  const blob = doc.output("blob");

  // ── Estrategia 1: Capacitor nativo (APK Android) ──────────────
  const esCapacitor = !!(
    window.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNative
  );

  if (esCapacitor) {
    try {
      // Capacitor 8: importar desde los módulos instalados via bridge
      // Los plugins en Capacitor 8 se acceden desde window.Capacitor.Plugins
      // Capacitor 8: plugins disponibles en window.Capacitor.Plugins
      const Plugins = window.Capacitor?.Plugins || {};
      const Filesystem = Plugins.Filesystem;
      const Share = Plugins.Share;

      // Debug: mostrar qué plugins hay disponibles
      console.log("[PDF] Capacitor plugins disponibles:", Object.keys(Plugins));
      console.log("[PDF] Filesystem:", !!Filesystem, "Share:", !!Share);

      if (Filesystem && Share) {
        // Convertir blob a base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Guardar en caché temporal
        await Filesystem.writeFile({
          path: nombreArchivo,
          data: base64,
          directory: "CACHE",
        });

        const { uri } = await Filesystem.getUri({
          path: nombreArchivo,
          directory: "CACHE",
        });

        // Compartir con menú nativo de Android
        await Share.share({
          title: "Mueblimex",
          text: textoMensaje || "Comprobante de Mueblimex",
          url: uri,
          dialogTitle: "Enviar recibo",
        });

        return { compartido: true };
      }
    } catch (e) {
      const cancelado = /cancel|abort/i.test(e.message || "");
      if (cancelado) return { compartido: false, cancelado: true };
      console.warn("Capacitor share falló, intentando navigator.share:", e);
    }
  }

  // ── Estrategia 2: Web Share API con archivo (Chrome móvil) ────
  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], nombreArchivo, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Mueblimex",
          text: textoMensaje || "Comprobante de Mueblimex",
        });
        return { compartido: true };
      }
    } catch (e) {
      if (e.name === "AbortError")
        return { compartido: false, cancelado: true };
      console.warn("navigator.share falló:", e);
    }
  }

  // ── Estrategia 3: Descarga directa (web escritorio) ───────────
  doc.save(nombreArchivo);
  return { compartido: false, descargado: true };
}

/* Solo descargar (sin intentar compartir) */
export function descargarPDF(doc, nombreArchivo) {
  doc.save(nombreArchivo);
}

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */
function recortar(texto, max) {
  texto = String(texto || "");
  return texto.length > max ? texto.slice(0, max - 1) + "…" : texto;
}

function limpiarNombre(nombre) {
  return String(nombre || "cliente")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 30);
}

/* ============================================================
   generarReciboIndividual({ credito, montoPagado, fechaPago, pagoId, vendedor })
   Genera el recibo de UN pago específico del historial.
   ============================================================ */
export async function generarReciboIndividual({
  credito,
  montoPagado,
  fechaPago,
  pagoId,
  vendedor,
}) {
  const nombre = `${credito.nombre || ""} ${credito.apePat || ""}`.trim();

  // Calcular cuántos pagos totales y cuántos hechos
  const pagosTotales = credito.total_pagos || 1;
  const pagosFaltantes = credito.pagos_faltantes || 0;
  const pagosHechos = pagosTotales - pagosFaltantes;

  // Calcular saldo aproximado (no exacto para pagos históricos)
  const cuota =
    credito.total_venta > 0 ? credito.total_venta / pagosTotales : 0;

  const { doc, nombreArchivo } = await generarReciboPago({
    nombreCliente: nombre,
    telefonoCliente: credito.telefono || credito.whatsapp || "",
    montoPagado,
    totalCredito: credito.total_venta || 0,
    saldoAnterior: credito.saldo + montoPagado,
    saldoNuevo: credito.saldo,
    pagosHechos,
    pagosTotales,
    proximoPago: fechaPago,
    nombreVendedor: vendedor || credito.nombre_vendedor || "",
    items:
      Array.isArray(credito.items) && credito.items.length > 0
        ? credito.items
        : null,
    producto: credito.producto || "",
  });

  // Compartir / descargar el PDF generado
  await compartirPDF(
    doc,
    nombreArchivo,
    `Recibo de pago de ${nombre} - ${money(montoPagado)} - Mueblimex`,
  );
}
