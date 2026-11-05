/* ============================================================
   js/vencimientos.js · Cálculo real de fechas de cobranza
   ------------------------------------------------------------
   LÓGICA ACORDADA:
   - Las fechas se cuentan DESDE la entrega del mueble.
   - Fechas FIJAS: cada 15 días (quincenal) o 30 días (mensual)
     exactos desde la entrega. No se recalculan al pagar.
   - Un cliente está VENCIDO apenas pasa la fecha de pago
     (sin días de gracia).

   Ejemplo (quincenal, entregado el 1 de mayo):
     Pago 1 → 16 may   Pago 2 → 31 may   Pago 3 → 15 jun ...

   Cómo sabemos cuántos pagos ya hizo:
   Usamos "pagos_faltantes". Si el plan era de 6 pagos y faltan
   4, ya hizo 2. El próximo vencimiento es el del pago 3.
   ============================================================ */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------
   calcularVencimiento(credito)
   Recibe un objeto crédito de Firestore y devuelve:
   {
     proximaFecha,     // Date del próximo pago
     diasRestantes,    // número (negativo = vencido)
     estado,           // "liquidado" | "vencido" | "urgente" |
                       //   "porVencer" | "alCorriente"
     pagosHechos,      // cuántos pagos lleva
     pagosTotales,     // total de pagos del plan
     etiqueta,         // texto listo para mostrar
     color             // "verde" | "amarillo" | "rojo" | "azul"
   }
------------------------------------------------------------ */
export function calcularVencimiento(credito) {
  const pagosTotales = Number(credito.total_pagos) || 1;
  const pagosFaltantes = Number(credito.pagos_faltantes) || 0;
  const pagosHechos = Math.max(0, pagosTotales - pagosFaltantes);
  const saldo = Number(credito.saldo) || 0;

  // Intervalo entre pagos según la frecuencia
  const frecuencia = String(credito.frecuencia || "Mensual").toLowerCase();
  const intervaloDias = frecuencia.includes("quincenal") ? 15 : 30;

  // --- Caso 1: crédito ya liquidado ---
  if (saldo <= 0 || pagosFaltantes <= 0) {
    return {
      proximaFecha: null,
      diasRestantes: null,
      estado: "liquidado",
      pagosHechos: pagosTotales,
      pagosTotales,
      etiqueta: "✅ Crédito liquidado",
      color: "azul"
    };
  }

  // --- Fecha de entrega (base del cálculo) ---
  const fechaEntrega = obtenerFechaEntrega(credito);
  if (!fechaEntrega) {
    // Sin fecha de entrega no podemos calcular: estado neutro
    return {
      proximaFecha: null,
      diasRestantes: null,
      estado: "alCorriente",
      pagosHechos,
      pagosTotales,
      etiqueta: "Fecha de entrega no registrada",
      color: "verde"
    };
  }

  // --- Próximo pago = pago número (pagosHechos + 1) ---
  // El pago N vence a los N * intervalo días de la entrega.
  const numeroProximoPago = pagosHechos + 1;
  const proximaFecha = new Date(fechaEntrega.getTime());
  proximaFecha.setDate(proximaFecha.getDate() + numeroProximoPago * intervaloDias);

  // --- Días restantes (hoy vs próximo pago) ---
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaPagoSinHora = new Date(proximaFecha.getTime());
  fechaPagoSinHora.setHours(0, 0, 0, 0);

  const diasRestantes = Math.round(
    (fechaPagoSinHora.getTime() - hoy.getTime()) / MS_POR_DIA
  );

  // --- Determinar estado y color ---
  let estado, color, etiqueta;

  if (diasRestantes < 0) {
    estado = "vencido";
    color = "rojo";
    const diasVencido = Math.abs(diasRestantes);
    etiqueta = `🔴 Vencido hace ${diasVencido} día${diasVencido > 1 ? "s" : ""}`;
  } else if (diasRestantes === 0) {
    estado = "urgente";
    color = "rojo";
    etiqueta = "🔴 Vence HOY";
  } else if (diasRestantes <= 5) {
    estado = "urgente";
    color = "rojo";
    etiqueta = `🔴 Vence en ${diasRestantes} día${diasRestantes > 1 ? "s" : ""}`;
  } else if (diasRestantes <= 14) {
    estado = "porVencer";
    color = "amarillo";
    etiqueta = `🟡 Vence en ${diasRestantes} días`;
  } else {
    estado = "alCorriente";
    color = "verde";
    etiqueta = `🟢 Vence en ${diasRestantes} días`;
  }

  return {
    proximaFecha,
    diasRestantes,
    estado,
    pagosHechos,
    pagosTotales,
    etiqueta,
    color
  };
}

/* ------------------------------------------------------------
   obtenerFechaEntrega(credito)
   Intenta obtener la fecha de entrega del crédito.
   - Primero busca "fecha_entrega" (campo nuevo).
   - Si no, usa "creado" como aproximación (créditos viejos).
   Devuelve un objeto Date o null.
------------------------------------------------------------ */
function obtenerFechaEntrega(credito) {
  // Campo nuevo: fecha_entrega (Timestamp de Firestore)
  if (credito.fecha_entrega && credito.fecha_entrega.seconds) {
    return new Date(credito.fecha_entrega.seconds * 1000);
  }
  // Respaldo: fecha de creación del crédito
  if (credito.creado && credito.creado.seconds) {
    return new Date(credito.creado.seconds * 1000);
  }
  return null;
}

/* ------------------------------------------------------------
   formatearFecha(date)
   Convierte un Date a texto legible en español.
------------------------------------------------------------ */
export function formatearFecha(date) {
  if (!date) return "—";
  return date.toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric"
  });
}

/* ------------------------------------------------------------
   esColorMarcador(color)
   Convierte el color del vencimiento al ícono de pin de
   Google Maps correspondiente.
------------------------------------------------------------ */
export function colorAPin(color) {
  const mapa = {
    rojo: "red",
    amarillo: "yellow",
    verde: "green",
    azul: "blue"
  };
  return mapa[color] || "green";
}
