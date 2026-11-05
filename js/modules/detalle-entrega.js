/* ============================================================
   modules/detalle-entrega.js · Detalle de solicitud / entrega
   Equivale a DetalleEntregaActivity.kt + activity_detalle_entrega.xml
   - Gerente + pendiente  → puede APROBAR o RECHAZAR
   - Vendedor + aprobado  → puede CONFIRMAR ENTREGA
   - Muestra fotos del cliente (rostro, INE, casa)
   ============================================================ */

import {
  actualizarEstadoCredito,
  rechazarSolicitud,
  getDetalleCredito,
} from "../data.js";
import { cacheInvalidar } from "../cache.js";
import { getPerfil } from "../auth.js";
import { money, esc, toast, confirmDialog } from "../ui.js";
import { volver } from "../router.js";

export async function render(root, params) {
  const perfil = await getPerfil();
  if (!perfil) {
    toast("Sesión caducada", "err");
    volver();
    return;
  }

  const rol = String(perfil.rol).toLowerCase();

  // Recargamos el crédito completo desde Firestore (datos frescos)
  let e = params.entrega;
  try {
    const fresco = await getDetalleCredito(e.id);
    if (fresco) e = fresco;
  } catch (_) {
    /* usamos lo que llegó por params */
  }

  const nombre = `${e.nombre || ""} ${e.apePat || ""} ${e.apeMat || ""}`.trim();
  const estatus = e.estatus; // 1=pendiente 2=aprobado 3=entregado

  // Determinar qué botones mostrar
  const gerentePuedeDecidir = rol === "gerente" && estatus === 1;
  const vendedorPuedeEntregar = rol === "vendedor" && estatus === 2;

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">←</button>
      <h1>Detalle de la solicitud</h1>
    </div>

    <div class="screen-pad">
      <div class="card">
        <div class="row-between">
          <h2 style="font-size:18px">${esc(nombre)}</h2>
          ${badgeEstatus(estatus)}
        </div>
        <div class="li-sub">📍 ${esc(e.direccion_completa || e.colonia || "")}</div>
        <div class="divider"></div>
        <div class="sim-row"><span>RFC</span><strong>${esc(e.rfc || "—")}</strong></div>
        <div class="sim-row"><span>CURP</span><strong>${esc(e.curp || "—")}</strong></div>
        <!-- Productos: muestra lista completa si hay items, o el producto simple -->
        ${
          Array.isArray(e.items) && e.items.length > 1
            ? `
          <div style="margin-bottom:8px">
            <div style="font-size:12px;color:var(--txt2);margin-bottom:6px;font-weight:600">
              PRODUCTOS (${e.items.length})
            </div>
            ${e.items
              .map(
                (it) => `
              <div style="display:flex;justify-content:space-between;align-items:center;
                          padding:6px 0;border-bottom:1px solid var(--line)">
                <div style="flex:1;font-size:13px;font-weight:600">${esc(it.nombre || it.id || "—")}</div>
                <div style="font-size:12px;color:var(--txt2);margin-left:8px">×${it.cantidad || 1}</div>
                ${it.precio ? `<div style="font-size:13px;font-weight:700;color:var(--azul);margin-left:8px">${money(it.precio * (it.cantidad || 1))}</div>` : ""}
              </div>`,
              )
              .join("")}
          </div>
        `
            : `
          <div class="sim-row"><span>Producto</span>
            <strong>${esc(e.producto || (Array.isArray(e.items) && e.items[0]?.nombre) || "—")}</strong>
          </div>
        `
        }
        <div class="sim-row"><span>Total del crédito</span>
          <strong class="sim-total">${money(e.total_venta)}</strong></div>
        ${
          e.nombre_vendedor && rol === "gerente"
            ? `<div class="sim-row"><span>Vendedor</span><strong>${esc(e.nombre_vendedor)}</strong></div>`
            : ""
        }
      </div>

      <div class="card">
        <div class="card-title">Fotografías del cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${fotoMini(e.foto_rostro, "Rostro")}
          ${fotoMini(e.foto_ine, "INE")}
          ${fotoMini(e.foto_casa, "Casa")}
        </div>
      </div>

      <div id="zona-botones">
        ${
          gerentePuedeDecidir
            ? `
          <button class="btn btn-green btn-block mb-8" id="btn-aprobar">
            ✅ Aprobar solicitud
          </button>
          <button class="btn btn-red btn-block" id="btn-rechazar">
            ❌ Rechazar y eliminar
          </button>
        `
            : ""
        }
        ${
          vendedorPuedeEntregar
            ? `
          <button class="btn btn-primary btn-block" id="btn-entregar">
            📦 Confirmar entrega
          </button>
        `
            : ""
        }
        ${
          !gerentePuedeDecidir && !vendedorPuedeEntregar
            ? `
          <p class="muted text-center">No hay acciones disponibles para este estado.</p>
        `
            : ""
        }
      </div>
    </div>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);

  // --- Acciones del gerente ---
  if (gerentePuedeDecidir) {
    root.querySelector("#btn-aprobar").addEventListener("click", async () => {
      const ok = await confirmDialog(
        "✅ Aprobar solicitud",
        `¿Aprobar el crédito de ${nombre}?\n\nEl vendedor podrá proceder con la entrega.`,
        "Aprobar",
        "btn-green",
      );
      if (!ok) return;
      await ejecutar(
        root,
        () => actualizarEstadoCredito(e.id, 2),
        "Solicitud aprobada",
      );
    });

    root.querySelector("#btn-rechazar").addEventListener("click", async () => {
      const ok = await confirmDialog(
        "❌ Rechazar solicitud",
        `¿Rechazar el crédito de ${nombre}?\n\nSe eliminarán todos sus datos registrados.`,
        "Rechazar y eliminar",
        "btn-red",
      );
      if (!ok) return;
      await ejecutar(
        root,
        () => rechazarSolicitud(e.id),
        "Solicitud rechazada y datos eliminados",
      );
    });
  }

  // --- Acción del vendedor ---
  if (vendedorPuedeEntregar) {
    root.querySelector("#btn-entregar").addEventListener("click", async () => {
      const ok = await confirmDialog(
        "📦 Confirmar entrega",
        `¿Confirmas que entregaste el producto a ${nombre}?`,
        "Confirmar",
        "btn-primary",
      );
      if (!ok) return;
      await ejecutar(
        root,
        () => actualizarEstadoCredito(e.id, 3),
        "Entrega confirmada",
      );
    });
  }
}

/* Ejecuta una acción async, deshabilita botones y vuelve atrás al terminar */
async function ejecutar(root, accion, mensajeExito) {
  const botones = root.querySelectorAll("#zona-botones button");
  botones.forEach((b) => (b.disabled = true));
  // Mostrar estado visual inmediato
  botones.forEach((b) => {
    b.style.opacity = "0.5";
  });
  try {
    await accion();
    toast(mensajeExito, "ok");

    // Invalidar cachés para que entregas recargue desde Firestore
    const { getPerfil } = await import("../auth.js");
    const perfil = await getPerfil();
    if (perfil) {
      await cacheInvalidar(`entregas_${perfil.uid}`);
      await cacheInvalidar(`avisos_${perfil.uid}`);
    }
    // Invalidar también clientes si fue una entrega (estatus 3)
    Object.keys(localStorage)
      .filter(
        (k) =>
          k.startsWith("mx_cache_clientes_") ||
          k.startsWith("mx_cache_estadisticas"),
      )
      .forEach((k) => localStorage.removeItem(k));

    volver();
  } catch (e) {
    console.error(e);
    toast("Error: " + (e.message || "intenta de nuevo"), "err");
    botones.forEach((b) => {
      b.disabled = false;
      b.style.opacity = "1";
    });
  }
}

function badgeEstatus(estatus) {
  if (estatus === 1) return `<span class="badge pendiente">Pendiente</span>`;
  if (estatus === 2) return `<span class="badge aprobado">Aprobado</span>`;
  return `<span class="badge entregado">Entregado</span>`;
}

/* Miniatura de foto. Si no hay URL, muestra placeholder. */
function fotoMini(url, etiqueta) {
  if (url) {
    return `
      <div>
        <img src="${esc(url)}" style="width:100%;height:90px;object-fit:cover;border-radius:8px"
             onclick="window.open('${esc(url)}','_blank')">
        <div class="muted text-center" style="font-size:11px;margin-top:2px">${etiqueta}</div>
      </div>`;
  }
  return `
    <div>
      <div style="width:100%;height:90px;background:#eee;border-radius:8px;
                  display:flex;align-items:center;justify-content:center">📷</div>
      <div class="muted text-center" style="font-size:11px;margin-top:2px">${etiqueta}</div>
    </div>`;
}
