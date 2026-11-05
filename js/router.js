/* ============================================================
   router.js · Enrutador de pantallas (SPA)
   AMPLIADO (Fase A): rutas dashboard y editar-cliente
   ============================================================ */

import { cacheLimpiar } from "./cache.js";
cacheLimpiar(); // limpiar entradas expiradas al arrancar

import { $, $$ } from "./ui.js";

import * as login        from "./modules/login.js";
import * as inicio       from "./modules/inicio.js";
import * as clientes     from "./modules/clientes.js";
import * as mapa         from "./modules/mapa.js";
import * as entregas     from "./modules/entregas.js";
import * as perfil       from "./modules/perfil.js";
import * as detalleProd  from "./modules/detalle-producto.js";
import * as carrito      from "./modules/carrito-screen.js";
import * as datosCliente from "./modules/datos-cliente.js";
import * as fotosReg     from "./modules/fotos-registro.js";
import * as selUbic      from "./modules/seleccionar-ubicacion.js";
import * as detalleCobro from "./modules/detalle-cobro.js";
import * as pagoDetalle  from "./modules/pago-detalle.js";
import * as detalleEntr  from "./modules/detalle-entrega.js";
import * as almacen      from "./modules/gestionar-almacen.js";
import * as vendedores   from "./modules/gestionar-vendedores.js";
// NUEVO Fase A:
import * as dashboard    from "./modules/dashboard.js";
import * as editarCli    from "./modules/editar-cliente.js";
import * as dashVendedor from "./modules/dashboard-vendedor.js";
import * as contado      from "./modules/contado.js";
import * as ofertas      from "./modules/ofertas.js";

const RUTAS = {
  "login":                 { mod: login,        tab: false },
  "inicio":                { mod: inicio,       tab: true  },
  "clientes":              { mod: clientes,     tab: true  },
  "mapa":                  { mod: mapa,         tab: true  },
  "entregas":              { mod: entregas,     tab: true  },
  "perfil":                { mod: perfil,       tab: true  },
  "detalle-producto":      { mod: detalleProd,  tab: false },
  "carrito":               { mod: carrito,      tab: false },
  "datos-cliente":         { mod: datosCliente, tab: false },
  "fotos-registro":        { mod: fotosReg,     tab: false },
  "seleccionar-ubicacion": { mod: selUbic,      tab: false },
  "detalle-cobro":         { mod: detalleCobro, tab: false },
  "pago-detalle":          { mod: pagoDetalle,  tab: false },
  "detalle-entrega":       { mod: detalleEntr,  tab: false },
  "gestionar-almacen":     { mod: almacen,      tab: false },
  "gestionar-vendedores":  { mod: vendedores,   tab: false },
  // NUEVO Fase A:
  "dashboard":             { mod: dashboard,    tab: false },
  "editar-cliente":        { mod: editarCli,    tab: false },
  "dashboard-vendedor":    { mod: dashVendedor, tab: false },
  "contado":               { mod: contado,      tab: false },
  "ofertas":               { mod: ofertas,      tab: false },
};

const pila = [];

export async function navega(ruta, params = {}) {
  const def = RUTAS[ruta];
  if (!def) { console.error("Ruta desconocida:", ruta); return; }

  if (ruta !== "login" && pila[pila.length - 1]?.ruta !== ruta) {
    pila.push({ ruta, params });
  }

  const nav = $("#bottom-nav");
  const root = $("#app-root");
  if (def.tab) {
    nav.classList.remove("hidden");
    root.classList.remove("no-nav");
    $$(".nav-item").forEach((b) =>
      b.classList.toggle("active", b.dataset.route === ruta));
  } else {
    nav.classList.add("hidden");
    root.classList.add("no-nav");
  }

  root.innerHTML = "";
  root.scrollTop = 0;
  window.scrollTo(0, 0);
  try {
    await def.mod.render(root, params);
  } catch (e) {
    console.error("Error al renderizar", ruta, e);
    const sinConex = !navigator.onLine ||
      String(e.message || "").toLowerCase().includes("network") ||
      String(e.message || "").toLowerCase().includes("offline") ||
      String(e.message || "").toLowerCase().includes("unavailable");
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  min-height:70vh;padding:32px;text-align:center;gap:16px">
        <div style="font-size:56px">${sinConex ? "📡" : "⚠️"}</div>
        <div style="font-size:17px;font-weight:700;color:var(--txt1)">
          ${sinConex ? "Sin conexión a internet" : "Ocurrió un error"}
        </div>
        <div style="font-size:13px;color:var(--txt2);max-width:280px">
          ${sinConex
            ? "Revisa tu señal e intenta de nuevo."
            : (e.message || "No se pudo cargar esta pantalla.")}
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center">
          <button id="err-recargar" class="btn btn-primary" style="min-width:130px">
            🔄 Reintentar
          </button>
          <button id="err-volver" class="btn btn-ghost" style="min-width:130px">
            ← Volver
          </button>
        </div>
      </div>`;
    root.querySelector("#err-recargar").addEventListener("click", () => navega(ruta, params));
    root.querySelector("#err-volver").addEventListener("click", () => volver());
  }
}

export function volver() {
  pila.pop();
  const anterior = pila[pila.length - 1];
  if (anterior) {
    pila.pop();
    navega(anterior.ruta, anterior.params);
  } else {
    navega("inicio");
  }
}

export function initNav() {
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      pila.length = 0;
      navega(btn.dataset.route);
    });
  });
}

export function resetPila() { pila.length = 0; }
