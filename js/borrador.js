/* ============================================================
   js/borrador.js · Guardar la venta a medias
   ------------------------------------------------------------
   Si el vendedor cierra la app o se le acaba la batería a
   media venta, este módulo guarda el progreso en el celular
   (localStorage) para poder continuar después.

   QUÉ se guarda:
     - El carrito (productos elegidos)
     - Los datos del cliente a medio llenar
   QUÉ NO se guarda:
     - Las fotos (pesan demasiado para localStorage)

   Las fotos se vuelven a tomar al continuar (es rápido).
   ============================================================ */

const CLAVE_BORRADOR = "mx_borrador_venta";

/* ------------------------------------------------------------
   guardarBorrador(datos)
   Guarda el progreso de la venta. "datos" puede incluir:
     { carrito, formCliente, paso }
------------------------------------------------------------ */
export function guardarBorrador(datos) {
  try {
    const borrador = {
      ...datos,
      guardadoEn: Date.now()
    };
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
  } catch (e) {
    // localStorage puede fallar si está lleno; no es crítico
    console.warn("No se pudo guardar el borrador:", e);
  }
}

/* ------------------------------------------------------------
   obtenerBorrador()
   Devuelve el borrador guardado, o null si no hay.
   Los borradores de más de 24 horas se descartan
   (probablemente ya no le sirven al vendedor).
------------------------------------------------------------ */
export function obtenerBorrador() {
  try {
    const texto = localStorage.getItem(CLAVE_BORRADOR);
    if (!texto) return null;

    const borrador = JSON.parse(texto);

    // Descartar borradores viejos (más de 24 horas)
    const horas = (Date.now() - (borrador.guardadoEn || 0)) / (1000 * 60 * 60);
    if (horas > 24) {
      limpiarBorrador();
      return null;
    }

    return borrador;
  } catch (e) {
    console.warn("No se pudo leer el borrador:", e);
    return null;
  }
}

/* ------------------------------------------------------------
   hayBorrador()
   true si existe un borrador de venta sin terminar.
------------------------------------------------------------ */
export function hayBorrador() {
  return obtenerBorrador() !== null;
}

/* ------------------------------------------------------------
   limpiarBorrador()
   Borra el borrador. Llamar cuando la venta se completa
   o cuando el vendedor decide descartarla.
------------------------------------------------------------ */
export function limpiarBorrador() {
  try {
    localStorage.removeItem(CLAVE_BORRADOR);
  } catch (e) {
    console.warn("No se pudo limpiar el borrador:", e);
  }
}

/* ------------------------------------------------------------
   resumenBorrador()
   Devuelve un texto corto describiendo el borrador, para
   mostrarlo en el aviso de "tienes una venta sin terminar".
------------------------------------------------------------ */
export function resumenBorrador() {
  const b = obtenerBorrador();
  if (!b) return "";

  const partes = [];

  if (b.carrito && b.carrito.length > 0) {
    const n = b.carrito.length;
    partes.push(`${n} producto${n > 1 ? "s" : ""}`);
  }
  if (b.formCliente && b.formCliente["f-nombre"]) {
    partes.push(`cliente: ${b.formCliente["f-nombre"]}`);
  }

  return partes.length > 0 ? partes.join(" · ") : "Venta sin terminar";
}
