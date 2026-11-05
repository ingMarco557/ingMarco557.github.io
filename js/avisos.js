/* ============================================================
   js/avisos.js · Sistema de avisos con caché agresiva
   ------------------------------------------------------------
   ESTRATEGIA:
   - obtenerAvisos() se cachea 5 minutos completos
   - actualizarBadgeNav() usa la misma caché, NO relanza query
   - abrirCampanita() usa la misma caché
   - Solo se refresca si el usuario fuerza (pull) o pasaron 5 min
   ============================================================ */

import { getEntregas, getClientesActivos, getProductos } from "./data.js";
import { money } from "./ui.js";
import { calcularVencimiento } from "./vencimientos.js";
import { getPerfil } from "./auth.js";
import { cacheGet, cacheSet, cacheInvalidar } from "./cache.js";

const LS_VISTAS = "mx_solicitudes_vistas";
const TTL_AVISOS = 5 * 60 * 1000; // 5 minutos

/* ── obtenerAvisos ─────────────────────────────────────────
   Caché de 5 min. Si la caché es válida NO va a Firestore.
   --------------------------------------------------------- */
export async function obtenerAvisos(forzar = false) {
  const perfil = await getPerfil();
  if (!perfil) return { totalPendientes: 0, nuevos: 0, lista: [], cobrosHoy: [] };

  const clave = `avisos_${perfil.uid}`;

  if (!forzar) {
    const cached = await cacheGet(clave, TTL_AVISOS);
    if (cached) return cached;
  }

  const rol       = String(perfil.rol).toLowerCase();
  const esGerente = rol === "gerente";

  // 1. Pendientes (usa caché interna de getEntregas 3 min)
  let pendientes = [];
  try { pendientes = await getEntregas(perfil.uid, perfil.rol); }
  catch (e) { console.warn("avisos pendientes:", e); }

  const vistasAntes = parseInt(localStorage.getItem(LS_VISTAS) || "0", 10);
  const nuevos = Math.max(0, pendientes.length - vistasAntes);

  // 2. Cobros (usa caché interna de getClientesActivos 5 min)
  let cobrosHoy = [];
  try {
    const clientes = await getClientesActivos(perfil.uid, perfil.rol);
    cobrosHoy = clientes
      .map((c) => ({ ...c, _venc: calcularVencimiento(c) }))
      .filter((c) => {
        const v = c._venc;
        return v.estado !== "liquidado" &&
          (v.estado === "vencido" || v.estado === "urgente" || v.estado === "porVencer");
      })
      .sort((a, b) => (a._venc.diasRestantes ?? 999) - (b._venc.diasRestantes ?? 999));
  } catch (e) { console.warn("avisos cobros:", e); }

  // 3. Stock (usa caché 24h de getProductos)
  let agotados = [], stockBajo = [];
  if (esGerente) {
    try {
      const prods = await getProductos();
      agotados  = prods.filter((p) => (Number(p.stock) || 0) === 0);
      stockBajo = prods.filter((p) => { const s = Number(p.stock)||0; return s > 0 && s <= 3; });
    } catch (e) { console.warn("avisos stock:", e); }
  }

  // 4. Construir lista
  const lista = [];

  if (pendientes.length > 0) {
    lista.push(esGerente ? {
      icono: "📋", titulo: `${pendientes.length} solicitud${pendientes.length > 1 ? "es" : ""} por revisar`,
      detalle: nuevos > 0 ? `${nuevos} nueva${nuevos > 1 ? "s" : ""} desde tu última visita` : "Pendientes de aprobar",
      ruta: "entregas", esNuevo: nuevos > 0
    } : {
      icono: "📦", titulo: `${pendientes.length} entrega${pendientes.length > 1 ? "s" : ""} pendiente${pendientes.length > 1 ? "s" : ""}`,
      detalle: "Productos aprobados por entregar",
      ruta: "entregas", esNuevo: nuevos > 0
    });
  }

  const vencidos  = cobrosHoy.filter((c) => c._venc.estado === "vencido");
  const urgentes  = cobrosHoy.filter((c) => c._venc.estado === "urgente");
  const porVencer = cobrosHoy.filter((c) => c._venc.estado === "porVencer");
  if (vencidos.length)  lista.push({ icono:"🔴", titulo:`${vencidos.length} cobro${vencidos.length>1?"s":""} vencido${vencidos.length>1?"s":""}`,  detalle:"Pasó la fecha de pago", ruta:"clientes", esNuevo:true });
  if (urgentes.length)  lista.push({ icono:"🟠", titulo:`${urgentes.length} cobro${urgentes.length>1?"s":""} urgente${urgentes.length>1?"s":""}`,  detalle:"Vencen en 5 días o menos", ruta:"clientes", esNuevo:true });
  if (porVencer.length) lista.push({ icono:"🟡", titulo:`${porVencer.length} cobro${porVencer.length>1?"s":""} por vencer`, detalle:"Vencen en las próximas 2 semanas", ruta:"clientes", esNuevo:false });

  // MORA MÁXIMA (solo gerente) — clientes con más de 60 días sin pagar
  if (esGerente) {
    try {
      const todosClientes = await getClientesActivos(perfil.uid, "Gerente");
      const moraMaxima = todosClientes.filter(c => c.mora_maxima === true && (c.saldo || 0) > 0);
      moraMaxima.forEach((c) => {
        const nombre = `${c.nombre || ""} ${c.apePat || ""}`.trim();
        lista.unshift({
          icono: "🚨",
          titulo: `${nombre} — MORA MÁXIMA`,
          detalle: `${c.dias_vencidos || 60}+ días sin pagar. Saldo: ${money(c.saldo)}`,
          ruta: "clientes",
          esNuevo: true,
          tipo: "moraMaxima"
        });
      });
    } catch (e) { console.warn("mora máxima avisos:", e); }
  }

  agotados.forEach((p) => lista.unshift({
    icono:"🚨", titulo:`${p.nombre} — AGOTADO`,
    detalle:"Sin stock. Restablece el inventario o elimina el producto.",
    ruta:"gestionar-almacen", esNuevo:true,
    tipo:"agotado", productoId:p.id, productoNombre:p.nombre
  }));
  stockBajo.forEach((p) => lista.push({
    icono:"⚠️", titulo:`${p.nombre} — stock bajo`,
    detalle:`Solo quedan ${p.stock} unidad${Number(p.stock)===1?"":"es"}.`,
    ruta:"gestionar-almacen", esNuevo:false,
    tipo:"stockBajo", productoId:p.id, productoNombre:p.nombre
  }));

  const resultado = { totalPendientes: pendientes.length, nuevos, lista, cobrosHoy };

  // Guardar en caché 5 min
  await cacheSet(clave, resultado);

  return resultado;
}

export function marcarSolicitudesVistas(cantidad) {
  localStorage.setItem(LS_VISTAS, String(cantidad));
}

/* ── actualizarBadgeNav ────────────────────────────────────
   USA LA MISMA CACHÉ — no lanza consultas nuevas si ya hay datos.
   --------------------------------------------------------- */
export async function actualizarBadgeNav() {
  try {
    const avisos = await obtenerAvisos(); // usa caché si está fresca
    const btn = document.querySelector('.nav-item[data-route="entregas"]');
    if (!btn) return;
    const viejo = btn.querySelector(".nav-badge");
    if (viejo) viejo.remove();
    if (avisos.totalPendientes > 0) {
      const badge = document.createElement("span");
      badge.className = "nav-badge";
      badge.textContent = avisos.totalPendientes > 9 ? "9+" : avisos.totalPendientes;
      btn.appendChild(badge);
    }
    return avisos;
  } catch (e) { console.warn("badge:", e); }
}

/* ── abrirCampanita ────────────────────────────────────────
   Primero usa caché. Si el usuario toca "Actualizar" fuerza refresh.
   --------------------------------------------------------- */
export async function abrirCampanita() {
  const { openModal, closeModal, confirmDialog, toast } = await import("./ui.js");
  const { navega } = await import("./router.js");

  // Mostrar modal rápido con datos en caché mientras carga
  const box = openModal(`<h2>🔔 Avisos</h2>
    <div style="text-align:center;padding:20px 0;color:var(--txt2)">Cargando...</div>`);

  // Primero intenta con caché (instantáneo)
  let avisos = await obtenerAvisos(false);

  const renderAvisos = (avisos, forzado = false) => {
    if (avisos.lista.length === 0) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="margin:0">🔔 Avisos</h2>
          ${!forzado ? `<button id="av-refresh" style="background:none;border:none;cursor:pointer;font-size:18px" title="Actualizar">🔄</button>` : ""}
        </div>
        <div style="text-align:center;padding:30px 10px;color:var(--txt2)">
          <div style="font-size:32px;margin-bottom:10px;opacity:.4">✅</div>
          <p>No tienes avisos pendientes</p>
        </div>
        <button class="btn btn-ghost btn-block" id="av-cerrar">Cerrar</button>`;
    } else {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="margin:0">🔔 Avisos</h2>
          ${!forzado ? `<button id="av-refresh" style="background:none;border:none;cursor:pointer;font-size:18px" title="Actualizar">🔄</button>` : ""}
        </div>
        <div id="av-lista">
          ${avisos.lista.map((a, i) => `
            <div class="aviso-item" data-ruta="${a.ruta}" data-tipo="${a.tipo||""}"
                 style="display:flex;gap:12px;align-items:flex-start;padding:14px 4px;
                        ${i < avisos.lista.length-1 ? "border-bottom:1px solid var(--line)" : ""};cursor:pointer">
              <div style="font-size:22px;flex-shrink:0">${a.icono}</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:14px">
                  ${a.titulo}
                  ${a.esNuevo ? `<span style="background:var(--rojo);color:#fff;font-size:9px;font-weight:800;padding:2px 7px;border-radius:100px;margin-left:6px;vertical-align:middle">NUEVO</span>` : ""}
                </div>
                <div style="font-size:12px;color:var(--txt2);margin-top:2px">${a.detalle}</div>
                ${a.tipo === "agotado" ? `
                  <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                    <button class="btn btn-sm btn-primary btn-restablecer" data-id="${a.productoId}" data-nombre="${a.productoNombre}" style="font-size:11px">📦 Restablecer</button>
                    <button class="btn btn-sm btn-red btn-eliminar" data-id="${a.productoId}" data-nombre="${a.productoNombre}" style="font-size:11px">🗑️ Eliminar</button>
                  </div>` : ""}
              </div>
              ${!a.tipo ? `<div style="font-size:18px;color:var(--txt2);flex-shrink:0">›</div>` : ""}
            </div>`).join("")}
        </div>
        <button class="btn btn-ghost btn-block" id="av-cerrar" style="margin-top:12px">Cerrar</button>`;
    }

    box.querySelector("#av-cerrar")?.addEventListener("click", closeModal);

    // Botón actualizar — fuerza recarga desde Firestore
    box.querySelector("#av-refresh")?.addEventListener("click", async () => {
      box.querySelector("#av-refresh").textContent = "⏳";
      box.querySelector("#av-refresh").disabled = true;
      // Invalidar caché de avisos
      const perfil = await getPerfil();
      if (perfil) localStorage.removeItem(`mx_cache_avisos_${perfil.uid}`);
      const frescos = await obtenerAvisos(true);
      renderAvisos(frescos, true);
    });

    // Navegar al tocar avisos normales
    box.querySelectorAll(".aviso-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        if (!item.dataset.tipo) { closeModal(); navega(item.dataset.ruta); }
      });
    });

    // Restablecer stock
    box.querySelectorAll(".btn-restablecer").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id, nombre = btn.dataset.nombre;
        const box2 = openModal(`
          <h2>📦 Restablecer stock</h2>
          <p class="muted" style="font-size:13px;margin-bottom:14px">
            ¿Cuántas unidades hay de <strong>${nombre}</strong>?
          </p>
          <div class="field">
            <input type="number" id="nuevo-stock" inputmode="numeric" min="1" placeholder="Ej. 10" />
          </div>
          <button class="btn btn-primary btn-block mb-8" id="btn-guardar-stock">Guardar</button>
          <button class="btn btn-ghost btn-block" id="btn-cancelar-stock">Cancelar</button>`);
        box2.querySelector("#btn-cancelar-stock").addEventListener("click", closeModal);
        box2.querySelector("#btn-guardar-stock").addEventListener("click", async () => {
          const n = parseInt(box2.querySelector("#nuevo-stock").value) || 0;
          if (n <= 0) { toast("Ingresa una cantidad válida", "warn"); return; }
          try {
            const { editarProducto, getProductos: gp } = await import("./data.js");
            const prods = await gp();
            const prod = prods.find((p) => p.id === id);
            if (!prod) throw new Error("Producto no encontrado");
            await editarProducto(id, { nombre: prod.nombre, categoria: prod.categoria,
              descripcion: prod.descripcion||"", costo: prod.costo, stock: n, imagenUrl: null });
            toast(`Stock actualizado a ${n}`, "ok");
            await cacheInvalidar(`avisos_${(await getPerfil())?.uid}`);
            closeModal(); closeModal();
          } catch (err) { toast("Error: " + err.message, "err"); }
        });
      });
    });

    // Eliminar producto
    box.querySelectorAll(".btn-eliminar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id, nombre = btn.dataset.nombre;
        const ok = await confirmDialog("🗑️ Eliminar", `¿Eliminar "${nombre}" del catálogo?`, "Eliminar", "btn-red");
        if (!ok) return;
        try {
          const { eliminarProducto } = await import("./data.js");
          await eliminarProducto(id);
          toast(`"${nombre}" eliminado`, "ok");
          await cacheInvalidar(`avisos_${(await getPerfil())?.uid}`);
          closeModal();
        } catch (err) { toast("Error: " + err.message, "err"); }
      });
    });
  };

  renderAvisos(avisos);
}
