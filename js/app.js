/* ============================================================
   app.js · Punto de entrada de la aplicación
   AÑADIDO:
   - Actualiza el badge de avisos al iniciar sesión.
   - Inicia el monitor de conexión a internet.
   ============================================================ */

import { observarSesion } from "./auth.js";
import { navega, initNav, resetPila } from "./router.js";
import { hideLoader, showLoader } from "./ui.js";
import { actualizarBadgeNav } from "./avisos.js";
import { iniciarMonitorConexion } from "./conexion.js";

initNav();

// Monitor de conexión: muestra una barra si se pierde internet
iniciarMonitorConexion();

let sesionInicializada = false;

observarSesion((perfil) => {
  if (perfil) {
    if (!sesionInicializada) {
      resetPila();
      navega("inicio");
      sesionInicializada = true;

      setTimeout(() => {
        actualizarBadgeNav();
      }, 800);
    }
  } else {
    resetPila();
    navega("login");
    sesionInicializada = false;
  }
  hideLoader();
});

setTimeout(hideLoader, 6000);

window.MX = { navega, showLoader, hideLoader };
