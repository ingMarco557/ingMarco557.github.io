/* ============================================================
   js/conexion.js · Manejo del estado de conexión a internet
   ------------------------------------------------------------
   - Detecta cuando el celular pierde o recupera internet.
   - Muestra una barra de aviso "Sin conexión" arriba.
   - Ofrece una función para "envolver" operaciones de red y
     dar mensajes de error claros en vez de errores técnicos.
   ============================================================ */

/* ------------------------------------------------------------
   hayInternet()
   Devuelve true/false según si el dispositivo tiene conexión.
------------------------------------------------------------ */
export function hayInternet() {
  return navigator.onLine;
}

/* ------------------------------------------------------------
   iniciarMonitorConexion()
   Crea una barra de aviso que aparece cuando NO hay internet
   y desaparece cuando vuelve. Llamar una vez al inicio.
------------------------------------------------------------ */
export function iniciarMonitorConexion() {
  // Crear la barra de aviso (oculta al inicio)
  let barra = document.getElementById("barra-conexion");
  if (!barra) {
    barra = document.createElement("div");
    barra.id = "barra-conexion";
    barra.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0;
      background: #C62828; color: #fff;
      font-size: 13px; font-weight: 700;
      text-align: center; padding: 8px 12px;
      z-index: 9999; transform: translateY(-100%);
      transition: transform .3s ease;
    `;
    barra.textContent = "📡 Sin conexión a internet";
    document.body.appendChild(barra);
  }

  function mostrarBarra(sinInternet) {
    if (sinInternet) {
      barra.style.transform = "translateY(0)";
      barra.textContent = "📡 Sin conexión a internet";
      barra.style.background = "#C62828";
    } else {
      // Mostrar brevemente "conexión restaurada" en verde
      barra.style.transform = "translateY(0)";
      barra.textContent = "✓ Conexión restaurada";
      barra.style.background = "#2E7D32";
      setTimeout(() => {
        barra.style.transform = "translateY(-100%)";
      }, 2000);
    }
  }

  // Escuchar cambios de conexión
  window.addEventListener("offline", () => mostrarBarra(true));
  window.addEventListener("online", () => mostrarBarra(false));

  // Estado inicial
  if (!navigator.onLine) mostrarBarra(true);
}

/* ------------------------------------------------------------
   conRed(operacion, mensajeError)
   Envuelve una operación de red. Si no hay internet o la
   operación falla por conexión, lanza un error con un mensaje
   claro y amigable en vez del error técnico.

   Uso:
     await conRed(() => guardarEnFirestore(datos),
                   "No se pudo guardar la venta");
------------------------------------------------------------ */
export async function conRed(operacion, mensajeError = "No se pudo completar la operación") {
  // Revisar conexión ANTES de intentar
  if (!navigator.onLine) {
    throw new Error("Sin conexión a internet. Revisa tu señal e intenta de nuevo.");
  }

  try {
    return await operacion();
  } catch (e) {
    // Detectar errores típicos de red de Firebase
    const msg = String(e.message || e.code || "").toLowerCase();
    const esErrorDeRed =
      msg.includes("network") ||
      msg.includes("unavailable") ||
      msg.includes("timeout") ||
      msg.includes("offline") ||
      msg.includes("failed to fetch") ||
      e.code === "unavailable" ||
      e.code === "auth/network-request-failed";

    if (esErrorDeRed) {
      throw new Error(`${mensajeError}. Revisa tu conexión a internet e intenta de nuevo.`);
    }

    // Si no es error de red, relanzamos el error original
    throw e;
  }
}

/* ------------------------------------------------------------
   esperarConexion(timeoutMs)
   Espera hasta que haya internet, o se acaba el tiempo.
   Útil antes de una operación importante.
------------------------------------------------------------ */
export function esperarConexion(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (navigator.onLine) { resolve(true); return; }

    const alConectar = () => {
      window.removeEventListener("online", alConectar);
      clearTimeout(temporizador);
      resolve(true);
    };

    const temporizador = setTimeout(() => {
      window.removeEventListener("online", alConectar);
      resolve(false);
    }, timeoutMs);

    window.addEventListener("online", alConectar);
  });
}
