/* ============================================================
   modules/inicio.js · Catálogo (con sistema de avisos)
   AÑADIDO:
   - Campanita 🔔 en el topbar con punto rojo
   - Alerta de "clientes por cobrar" arriba del catálogo
   ============================================================ */

import { getProductos, getCategorias, aplicarInteresesMoratorios, precioConDescuento } from "../data.js";
import { tienePermiso, esGerente } from "../auth.js";
import { contarProductos } from "../carrito.js";
import { money, esc, skeletonList, toast } from "../ui.js";
import { navega } from "../router.js";
import { obtenerAvisos, abrirCampanita, actualizarBadgeNav } from "../avisos.js";

let todosProductos = [];
let filtroCategoria = "";
let filtroTexto = "";

export async function render(root) {
  root.innerHTML = `
    <div class="topbar">
      <h1>Mueblimex</h1>
      <button class="bell-btn" id="btn-campanita" aria-label="Avisos">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="bell-badge hidden" id="bell-dot" style="position:absolute;top:-4px;right:-4px;background:var(--rojo);color:#fff;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:100px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none"></span>
      </button>
      ${tienePermiso("venderContado") || esGerente() ? `
      <button class="topbar-action" id="btn-contado" aria-label="Venta al contado"
              title="Venta al contado" style="margin-left:4px">
        💵
      </button>` : ""}
      <button class="topbar-action cart-fab" id="btn-carrito" aria-label="Carrito" style="margin-left:8px">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
        </svg>
        <span class="cart-badge" id="cart-badge">0</span>
      </button>
    </div>

    <div class="search-bar">
      <svg class="search-ico" viewBox="0 0 24 24" width="18" height="18"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round"
           style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#aaa;pointer-events:none">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="edt-busqueda" placeholder="Buscar muebles..." />
    </div>

    <!-- Aquí se inyecta la alerta de cobros si los hay -->
    <div id="cont-cobros"></div>

    <div id="banner-ofertas" style="
        margin: 0 16px 14px;
        border-radius: 20px;
        background: linear-gradient(135deg, #1565C0 0%, #0D47A1 40%, #6A1B9A 100%);
        padding: 18px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 6px 24px rgba(21,101,192,0.35);
        overflow: hidden;
        position: relative;
        cursor: pointer;
      ">
      <!-- Destellos decorativos -->
      <div style="position:absolute;right:-10px;top:-10px;width:120px;height:120px;
                  background:radial-gradient(circle,rgba(255,255,255,0.12),transparent 70%);
                  border-radius:50%"></div>
      <div style="position:absolute;left:30%;bottom:-25px;width:90px;height:90px;
                  background:radial-gradient(circle,rgba(255,255,255,0.07),transparent 70%);
                  border-radius:50%"></div>
      <!-- Estrella decorativa izquierda -->
      <div style="position:absolute;left:12px;top:12px;font-size:16px;opacity:0.6">✦</div>
      <div style="position:relative;z-index:1;padding-left:14px">
        <div style="font-size:8px;letter-spacing:2px;color:rgba(255,255,255,0.7);
                    font-weight:700;text-transform:uppercase;margin-bottom:4px">
          MUEBLIMEX
        </div>
        <div style="font-size:19px;font-weight:900;color:#fff;line-height:1.15;
                    text-shadow:0 2px 8px rgba(0,0,0,0.2)">
          Ofertas del dia
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:5px;
                    font-weight:500;display:flex;align-items:center;gap:5px">
          <span style="display:inline-block;width:6px;height:6px;background:#FFD600;
                       border-radius:50%"></span>
          Hasta 6 meses sin intereses
        </div>
      </div>
      <div style="position:relative;z-index:1;flex-shrink:0">
        <div style="background:rgba(255,255,255,0.15);border-radius:16px;
                    padding:10px 16px;border:1.5px solid rgba(255,255,255,0.3);
                    text-align:center;backdrop-filter:blur(4px)">
          <div style="font-size:10px;color:rgba(255,255,255,0.8);font-weight:700;
                      letter-spacing:1px">HASTA</div>
          <div style="font-size:26px;font-weight:900;color:#FFD600;line-height:1;
                      text-shadow:0 0 20px rgba(255,214,0,0.5)">50%</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.8);font-weight:700;
                      letter-spacing:1px">DCTO</div>
        </div>
      </div>
    </div>

    <div class="cat-scroll" id="cat-scroll"></div>

    <div class="product-grid" id="product-grid">
      ${skeletonList(6)}
    </div>
  `;

  // Una sola llamada a Firestore para badge + cobros (usa caché 5 min)
  obtenerAvisos().then((avisos) => {
    mostrarBadge(root, avisos);
    cargarCobrosDesdeAvisos(root, avisos);
  }).catch((e) => console.warn("avisos inicio:", e));

  // Botón carrito
  root.querySelector("#btn-carrito").addEventListener("click", () => navega("carrito"));
  root.querySelector("#btn-contado")?.addEventListener("click", () => navega("contado"));

  // Actualizar badge del carrito al entrar
  actualizarBadge(root);

  // Escuchar cambios del carrito mientras está en pantalla
  window._onCartChange = () => actualizarBadge(root);

  // Aplicar intereses moratorios UNA VEZ al día (la función ya tiene caché diaria)
  aplicarInteresesMoratorios().catch((e) => console.warn("intereses:", e));

  // Botón campanita
  root.querySelector("#btn-campanita").addEventListener("click", () => abrirCampanita());

  // Buscador
  root.querySelector("#edt-busqueda").addEventListener("input", (e) => {
    filtroTexto = e.target.value.toLowerCase();
    pintarProductos(root);
  });

  // Cargar avisos (campanita + alerta de cobros + badge nav)
  cargarAvisos(root);

  // Revisar si hay una venta sin terminar (borrador)
  revisarBorrador(root);

  // Cargar catálogo
  try {
    const [productos, categorias] = await Promise.all([
      getProductos(),
      getCategorias()
    ]);
    todosProductos = productos;
    pintarCategorias(root, categorias);
    pintarProductos(root);
  } catch (e) {
    console.error(e);
    toast("Error al cargar el catálogo", "err");
    root.querySelector("#product-grid").innerHTML =
      `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">📦</div>No se pudo cargar el catálogo</div>`;
  }
}

/* Carga los avisos y pinta: punto rojo de la campana, alerta de
   cobros, y el badge de la barra de navegación. */
async function cargarAvisos(root) {
  // Esta función ya no es llamada directamente — se usa mostrarBadge y cargarCobrosDesdeAvisos
  // Se mantiene por compatibilidad
  try {
    const avisos = await obtenerAvisos(); // usa caché
    mostrarBadge(root, avisos);
    cargarCobrosDesdeAvisos(root, avisos);
  } catch (e) { console.warn("cargarAvisos:", e); }
}

/* Muestra el número en la campanita y el badge de entregas */
function mostrarBadge(root, avisos) {
  const dot = root.querySelector("#bell-dot");
  if (dot) {
    const total = avisos.lista.length;
    if (total > 0) {
      dot.classList.remove("hidden");
      dot.style.display = "flex";
      dot.textContent = total > 9 ? "9+" : total;
    } else {
      dot.classList.add("hidden");
      dot.style.display = "none";
    }
  }
  actualizarBadgeNav().catch(() => {});
}

/* Pinta la alerta de cobros usando datos ya cargados */
function cargarCobrosDesdeAvisos(root, avisos) {
  if (avisos.cobrosHoy && avisos.cobrosHoy.length > 0) {
    pintarAlertaCobros(root, avisos.cobrosHoy);
  }
}

/* Pinta la tarjeta naranja de "clientes por cobrar" */
function pintarAlertaCobros(root, cobros) {
  const cont = root.querySelector("#cont-cobros");
  // Mostramos máximo 3, con un "ver todos" si hay más
  const visibles = cobros.slice(0, 3);

  cont.innerHTML = `
    <div class="cobros-alerta">
      <div class="ca-title">📢 Clientes por cobrar (${cobros.length})</div>
      <div style="margin-top:8px">
        ${visibles.map((c) => {
          // c._venc viene calculado desde avisos.js (vencimiento real)
          const venc = c._venc || {};
          const nombre = `${c.nombre || ""} ${c.apePat || ""}`.trim();
          const color = venc.color === "rojo" ? "var(--rojo)"
                      : venc.color === "amarillo" ? "var(--naranja)"
                      : "var(--verde)";
          const txt = venc.etiqueta
            ? venc.etiqueta.replace(/^[🔴🟡🟢🟠]\s*/u, "")
            : "";
          return `
            <div class="ca-item" data-id="${c.id}" style="cursor:pointer">
              <span class="ca-dot" style="background:${color}"></span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${esc(nombre)}
                </div>
                <div style="font-size:11px;color:var(--txt2)">
                  Saldo ${money(c.saldo)} · ${txt}
                </div>
              </div>
              <div style="font-size:16px;color:var(--txt2)">›</div>
            </div>
          `;
        }).join("")}
      </div>
      ${cobros.length > 3 ? `
        <button class="btn btn-sm btn-ghost btn-block" id="btn-ver-cobros" style="margin-top:8px">
          Ver los ${cobros.length} clientes
        </button>
      ` : ""}
    </div>
  `;

  // Al tocar un cliente, ir a su detalle de cobro
  cont.querySelectorAll(".ca-item").forEach((item) => {
    item.addEventListener("click", () => {
      const cliente = cobros.find((c) => c.id === item.dataset.id);
      navega("detalle-cobro", { cliente });
    });
  });

  // Botón "ver todos"
  const btnVer = cont.querySelector("#btn-ver-cobros");
  if (btnVer) {
    btnVer.addEventListener("click", () => navega("clientes"));
  }
}

function pintarCategorias(root, categorias) {
  const cont = root.querySelector("#cat-scroll");
  const lista = [{ nombre: "Todos" }, ...categorias];
  cont.innerHTML = lista.map((c, i) => `
    <div class="cat-pill ${i === 0 ? "active" : ""}" data-cat="${esc(c.nombre)}">
      ${esc(c.nombre)}
    </div>
  `).join("");

  cont.querySelectorAll(".cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      cont.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      filtroCategoria = pill.dataset.cat === "Todos" ? "" : pill.dataset.cat;
      pintarProductos(root);
    });
  });
}

function pintarProductos(root) {
  const grid = root.querySelector("#product-grid");

  let lista = todosProductos;

  if (filtroCategoria) {
    lista = lista.filter((p) =>
      (p.categoria || "").toLowerCase() === filtroCategoria.toLowerCase());
  }
  if (filtroTexto) {
    lista = lista.filter((p) =>
      (p.nombre || "").toLowerCase().includes(filtroTexto) ||
      (p.descripcion || "").toLowerCase().includes(filtroTexto));
  }

  if (lista.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="es-icon">🔎</div>No se encontraron productos
    </div>`;
    return;
  }

  grid.innerHTML = lista.map((p) => {
    const enOferta = p.en_oferta && p.descuento > 0;
    const precioFinal = enOferta ? precioConDescuento(p.precio, p.descuento) : p.precio;
    return `
    <div class="product-card" data-id="${p.id}">
      <div style="position:relative">
        <img class="p-img" src="${esc(p.imagen) || placeholderImg()}"
             onerror="this.src='${placeholderImg()}'" alt="${esc(p.nombre)}">
        ${enOferta ? `
          <span style="position:absolute;top:6px;left:6px;background:#E53935;color:#fff;
                       font-size:11px;font-weight:900;padding:3px 8px;border-radius:100px">
            -${p.descuento}%
          </span>` : ""}
      </div>
      <div class="p-body">
        <div class="p-name">${esc(p.nombre)}</div>
        <div class="p-price-row">
          <span class="p-price" style="${enOferta ? "color:#E53935" : ""}">${money(precioFinal)}</span>
          ${enOferta
            ? `<span class="p-old" style="text-decoration:line-through;color:var(--txt2);font-size:12px">${money(p.precio)}</span>`
            : ""}  <!-- sin oferta: no mostrar precio tachado falso -->
        </div>
        <span class="p-tag">${enOferta ? "🔥 OFERTA" : "A crédito"}</span>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prod = todosProductos.find((p) => p.id === card.dataset.id);
      navega("detalle-producto", { producto: prod });
    });
  });
}

function actualizarBadge(root) {
  const badge = root.querySelector("#cart-badge");
  const n = contarProductos();
  badge.textContent = n;
  badge.style.display = n > 0 ? "flex" : "none";
}

function placeholderImg() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' fill='%23999' font-size='14' text-anchor='middle' dy='.3em'%3ESin imagen%3C/text%3E%3C/svg%3E";
}

/* ------------------------------------------------------------
   revisarBorrador(root)
   Si hay una venta sin terminar guardada, avisa al vendedor
   y le ofrece continuarla o descartarla.
------------------------------------------------------------ */
async function revisarBorrador(root) {
  try {
    const { hayBorrador, resumenBorrador, obtenerBorrador, limpiarBorrador } =
      await import("../borrador.js");

    if (!hayBorrador()) return;

    const { confirmDialog } = await import("../ui.js");
    const resumen = resumenBorrador();

    const continuar = await confirmDialog(
      "📝 Venta sin terminar",
      `Tienes una venta que no terminaste:\n\n${resumen}\n\n¿Quieres continuarla?\n(Las fotos se vuelven a tomar.)`,
      "Continuar venta", "btn-primary");

    if (continuar) {
      const borrador = obtenerBorrador();
      if (borrador && borrador.datosVenta) {
        // Restaurar el carrito
        if (borrador.carrito && borrador.carrito.length > 0) {
          const { agregarAlCarrito, limpiarCarrito } = await import("../carrito.js");
          limpiarCarrito();
          borrador.carrito.forEach((it) => {
            agregarAlCarrito(it, it.cantidad || 1);
          });
        }
        // Ir directo a la pantalla de datos del cliente
        navega("datos-cliente", borrador.datosVenta);
      }
    } else {
      // El vendedor descartó la venta
      limpiarBorrador();
    }
  } catch (e) {
    console.warn("Error al revisar borrador:", e);
  }
}
