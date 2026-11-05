/* ============================================================
   modules/mapa.js · Mapa de clientes con filtros avanzados
   ------------------------------------------------------------
   - Filtros por: monto de crédito, atraso, zona, vendedor
   - Marcadores SVG personalizados con color por estado
   - Zonas de Comitán pintadas con polígonos de color
   - Ubicación actual del usuario con pin animado
   - Toda la lógica de filtros sin llamadas extra a la API
   ============================================================ */

import { getClientesMapa, getVendedores } from "../data.js";
import { getPerfil, esGerente } from "../auth.js";
import { money, esc, toast } from "../ui.js";
import { cargarGoogleMaps } from "../maps-loader.js";
import { calcularVencimiento } from "../vencimientos.js";
import { COLONIAS_COMITAN } from "../colonias-comitan.js";

const COMITAN = { lat: 16.2521, lng: -92.1333 };

// Centros aproximados de cada zona para pintar áreas de color
const ZONAS_COLOR = {
  "Centro":    { color: "#1565C0", centro: { lat: 16.2521, lng: -92.1333 } },
  "Norte":     { color: "#2E7D32", centro: { lat: 16.2750, lng: -92.1350 } },
  "Sur":       { color: "#E65100", centro: { lat: 16.2300, lng: -92.1340 } },
  "Oriente":   { color: "#6A1B9A", centro: { lat: 16.2520, lng: -92.1150 } },
  "Poniente":  { color: "#00838F", centro: { lat: 16.2520, lng: -92.1520 } },
  "Periferia": { color: "#546E7A", centro: { lat: 16.2900, lng: -92.1600 } }
};

let map = null;
let marcadores = [];        // [{ marker, cliente, venc }]
let todosClientes = [];
let vendedores = [];
let marcadorUsuario = null;
let zonasOverlays = [];
let mostrarZonas = false;

let filtros = {
  monto:    "todos",  // todos | alto | medio | bajo
  atraso:   false,    // solo atrasados
  zona:     "todas",
  vendedor: "todos"
};

export async function render(root) {
  const gerente = esGerente();

  root.innerHTML = `
    <div class="topbar">
      <h1>Mapa de clientes</h1>
      <button id="btn-toggle-zonas" style="margin-left:auto;background:rgba(255,255,255,0.2);
              border:none;color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;
              font-weight:700;cursor:pointer">🎨 Zonas</button>
    </div>

    <!-- BARRA DE FILTROS -->
    <div style="background:#fff;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);
                position:relative;z-index:5">
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px"
           id="filtros-chips">
        <button class="chip-filtro active" data-filtro="todos">
          📋 Todos
        </button>
        <button class="chip-filtro" data-filtro="atraso">
          🔴 Atrasados
        </button>
        <button class="chip-filtro" data-filtro="alto">
          💎 Crédito alto
        </button>
        <button class="chip-filtro" data-filtro="medio">
          💰 Crédito medio
        </button>
        <button class="chip-filtro" data-filtro="bajo">
          🪙 Crédito bajo
        </button>
      </div>

      <!-- Selectores zona/vendedor -->
      <div style="display:flex;gap:8px;margin-top:8px">
        <select id="sel-zona" style="flex:1;padding:7px 10px;border:1px solid var(--line);
                border-radius:8px;font-size:12px;background:#fff">
          <option value="todas">🗺️ Todas las zonas</option>
          ${Object.keys(ZONAS_COLOR).map(z => `<option value="${z}">${z}</option>`).join("")}
        </select>
        ${gerente ? `
        <select id="sel-vendedor" style="flex:1;padding:7px 10px;border:1px solid var(--line);
                border-radius:8px;font-size:12px;background:#fff">
          <option value="todos">👥 Todos los vendedores</option>
        </select>` : ""}
      </div>

      <!-- Contador -->
      <div style="font-size:11px;color:var(--txt2);margin-top:8px;text-align:center"
           id="contador-clientes">
        Cargando clientes...
      </div>
    </div>

    <div style="position:relative">
      <div id="map-canvas" style="width:100%;height:calc(100vh - 230px);min-height:300px"></div>

      <!-- Botón ubicación -->
      <button id="btn-mi-ubicacion" style="position:absolute;bottom:90px;right:16px;
              width:48px;height:48px;border-radius:50%;background:#fff;border:none;
              box-shadow:0 3px 10px rgba(0,0,0,0.25);cursor:pointer;font-size:20px;
              display:flex;align-items:center;justify-content:center;z-index:4">
        📍
      </button>

      <!-- Panel info -->
      <div class="map-info-panel hidden" id="panel-info"
           style="position:absolute;bottom:0;left:0;right:0;background:#fff;
                  border-radius:20px 20px 0 0;padding:18px;
                  box-shadow:0 -4px 20px rgba(0,0,0,0.15);z-index:6">
        <span id="mi-close" style="position:absolute;top:14px;right:18px;font-size:20px;
              cursor:pointer;color:var(--txt2)">✕</span>
        <div id="panel-contenido"></div>
      </div>
    </div>

    <style>
      .chip-filtro {
        background:#f0f0f0; border:none; border-radius:100px;
        padding:7px 14px; font-size:12px; font-weight:700;
        white-space:nowrap; cursor:pointer; color:#555;
        transition:all .2s; flex-shrink:0;
      }
      .chip-filtro.active {
        background:linear-gradient(135deg,#1565C0,#42A5F5); color:#fff;
        box-shadow:0 2px 8px rgba(21,101,192,0.35);
      }
    </style>
  `;

  root.querySelector("#mi-close").addEventListener("click", () => {
    root.querySelector("#panel-info").classList.add("hidden");
  });

  try {
    await cargarGoogleMaps();
    await inicializarMapa(root, gerente);
  } catch (e) {
    console.error(e);
    root.querySelector("#map-canvas").innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🗺️</div>No se pudo cargar el mapa.</div>`;
  }
}

async function inicializarMapa(root, gerente) {
  const cont = root.querySelector("#map-canvas");

  map = new google.maps.Map(cont, {
    center: COMITAN,
    zoom: 13,
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
      { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { featureType: "water", stylers: [{ color: "#a8d5f0" }] },
      { featureType: "landscape", stylers: [{ color: "#f5f5f0" }] }
    ]
  });

  map.addListener("click", () => {
    root.querySelector("#panel-info").classList.add("hidden");
  });

  // Cargar datos
  try {
    const perfil = await getPerfil();
    if (!perfil) return;

    todosClientes = await getClientesMapa(perfil.uid, perfil.rol);
    // Pre-calcular vencimiento y zona de cada cliente
    todosClientes = todosClientes.map(c => ({
      ...c,
      _venc: calcularVencimiento(c),
      _zona: detectarZona(c.colonia)
    }));

    if (gerente) {
      vendedores = await getVendedores();
      const sel = root.querySelector("#sel-vendedor");
      vendedores.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.nombre;
        sel.appendChild(opt);
      });
    }

    conectarFiltros(root);
    aplicarFiltros(root);

  } catch (e) {
    console.error(e);
    toast("Error al cargar clientes", "err");
  }
}

/* ── Detectar zona de un cliente por su colonia ──────────── */
function detectarZona(colonia) {
  if (!colonia) return null;
  const c = colonia.toLowerCase();
  const encontrada = COLONIAS_COMITAN.find(col =>
    c.includes(col.nombre.toLowerCase()) || col.nombre.toLowerCase().includes(c)
  );
  return encontrada ? encontrada.zona : null;
}

/* ── Conectar los filtros ────────────────────────────────── */
function conectarFiltros(root) {
  // Chips de monto/atraso
  root.querySelectorAll(".chip-filtro").forEach(chip => {
    chip.addEventListener("click", () => {
      const f = chip.dataset.filtro;
      root.querySelectorAll(".chip-filtro").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");

      if (f === "atraso") {
        filtros.atraso = true;
        filtros.monto = "todos";
      } else {
        filtros.atraso = false;
        filtros.monto = f;
      }
      aplicarFiltros(root);
    });
  });

  // Selector de zona
  root.querySelector("#sel-zona")?.addEventListener("change", (e) => {
    filtros.zona = e.target.value;
    aplicarFiltros(root);
  });

  // Selector de vendedor
  root.querySelector("#sel-vendedor")?.addEventListener("change", (e) => {
    filtros.vendedor = e.target.value;
    aplicarFiltros(root);
  });

  // Toggle de zonas
  root.querySelector("#btn-toggle-zonas")?.addEventListener("click", () => {
    mostrarZonas = !mostrarZonas;
    if (mostrarZonas) pintarZonas(); else limpiarZonas();
    const btn = root.querySelector("#btn-toggle-zonas");
    btn.style.background = mostrarZonas ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)";
  });

  // Mi ubicación
  root.querySelector("#btn-mi-ubicacion")?.addEventListener("click", () => {
    ubicarUsuario(root);
  });
}

/* ── Aplicar filtros y redibujar marcadores ──────────────── */
function aplicarFiltros(root) {
  // Limpiar marcadores anteriores
  marcadores.forEach(m => m.marker.setMap(null));
  marcadores = [];

  const filtrados = todosClientes.filter(c => {
    // Filtro de monto
    const saldo = c.saldo || 0;
    if (filtros.monto === "alto"  && saldo < 10000) return false;
    if (filtros.monto === "medio" && (saldo < 5000 || saldo >= 10000)) return false;
    if (filtros.monto === "bajo"  && saldo >= 5000) return false;

    // Filtro de atraso
    if (filtros.atraso) {
      const est = c._venc.estado;
      if (est !== "vencido" && est !== "urgente") return false;
    }

    // Filtro de zona
    if (filtros.zona !== "todas" && c._zona !== filtros.zona) return false;

    // Filtro de vendedor
    if (filtros.vendedor !== "todos" && c.cv_usuario !== filtros.vendedor) return false;

    return true;
  });

  // Dibujar marcadores filtrados
  filtrados.forEach(c => agregarMarcador(root, c));

  // Contador
  const cont = root.querySelector("#contador-clientes");
  if (cont) {
    cont.textContent = `${filtrados.length} cliente${filtrados.length !== 1 ? "s" : ""} en el mapa`;
  }

  // Centrar el mapa en los marcadores si hay
  if (filtrados.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    filtrados.forEach(c => bounds.extend({ lat: c.latitud, lng: c.longitud }));
    map.fitBounds(bounds, 60);
    // No acercar demasiado si es un solo cliente
    google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() > 16) map.setZoom(16);
    });
  }
}

/* ── Marcador SVG personalizado ──────────────────────────── */
function agregarMarcador(root, cliente) {
  if (!cliente.latitud || !cliente.longitud) return;

  const venc = cliente._venc;
  const colores = {
    vencido:     "#E53935",
    urgente:     "#FB8C00",
    porVencer:   "#FDD835",
    alCorriente: "#43A047",
    liquidado:   "#8E24AA"
  };
  const color = colores[venc.estado] || "#1976D2";

  // Pin SVG personalizado tipo gota con sombra
  const svg = `
    <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sh" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path d="M20 2 C10 2 2 10 2 20 C2 32 20 50 20 50 C20 50 38 32 38 20 C38 10 30 2 20 2 Z"
            fill="${color}" stroke="#fff" stroke-width="2.5" filter="url(#sh)"/>
      <circle cx="20" cy="19" r="7" fill="#fff"/>
      <text x="20" y="24" font-size="11" font-weight="bold" text-anchor="middle"
            fill="${color}">$</text>
    </svg>`;

  const marcador = new google.maps.Marker({
    position: { lat: cliente.latitud, lng: cliente.longitud },
    map,
    title: `${cliente.nombre || ""} ${cliente.apePat || ""}`.trim(),
    icon: {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(40, 52),
      anchor: new google.maps.Point(20, 50)
    },
    animation: google.maps.Animation.DROP
  });

  marcador.addListener("click", () => mostrarInfo(root, cliente));
  marcadores.push({ marker: marcador, cliente, venc });
}

/* ── Pintar zonas con círculos de color ──────────────────── */
function pintarZonas() {
  Object.entries(ZONAS_COLOR).forEach(([zona, info]) => {
    const circulo = new google.maps.Circle({
      strokeColor: info.color,
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: info.color,
      fillOpacity: 0.12,
      map,
      center: info.centro,
      radius: 1400
    });
    // Etiqueta de la zona
    const label = new google.maps.Marker({
      position: info.centro,
      map,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
      label: {
        text: zona,
        color: info.color,
        fontSize: "13px",
        fontWeight: "800"
      }
    });
    zonasOverlays.push(circulo, label);
  });
}

function limpiarZonas() {
  zonasOverlays.forEach(o => o.setMap(null));
  zonasOverlays = [];
}

/* ── Ubicación del usuario con pin animado ───────────────── */
function ubicarUsuario(root) {
  if (!navigator.geolocation) {
    toast("Tu dispositivo no soporta geolocalización", "warn");
    return;
  }
  toast("Buscando tu ubicación...", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ubi = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (marcadorUsuario) marcadorUsuario.setMap(null);

      // Pin personalizado tipo "radar" pulsante
      const svgUsuario = `
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <circle cx="30" cy="30" r="14" fill="#1565C0" fill-opacity="0.2">
            <animate attributeName="r" values="14;26;14" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="30" cy="30" r="10" fill="#1565C0" stroke="#fff" stroke-width="3"/>
          <circle cx="30" cy="30" r="3.5" fill="#fff"/>
        </svg>`;

      marcadorUsuario = new google.maps.Marker({
        position: ubi,
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgUsuario),
          scaledSize: new google.maps.Size(60, 60),
          anchor: new google.maps.Point(30, 30)
        },
        title: "Tu ubicación",
        zIndex: 9999
      });

      map.panTo(ubi);
      map.setZoom(15);
      toast("📍 Ubicación encontrada", "ok");
    },
    (err) => {
      console.warn(err);
      toast("No se pudo obtener tu ubicación. Activa el GPS.", "warn");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ── Panel de información del cliente ─────────────────────── */
function mostrarInfo(root, c) {
  const panel = root.querySelector("#panel-info");
  const cont  = root.querySelector("#panel-contenido");
  const nombre = `${c.nombre || ""} ${c.apePat || ""}`.trim();
  const venc = c._venc;

  const estadoInfo = {
    vencido:     { color: "#E53935", icono: "🔴", label: "VENCIDO" },
    urgente:     { color: "#FB8C00", icono: "🟠", label: "URGENTE" },
    porVencer:   { color: "#F9A825", icono: "🟡", label: "Por vencer" },
    alCorriente: { color: "#43A047", icono: "🟢", label: "Al corriente" },
    liquidado:   { color: "#8E24AA", icono: "✅", label: "Liquidado" }
  }[venc.estado] || { color: "#1976D2", icono: "📋", label: venc.estado };

  const totalPagos = c.total_pagos || 0;
  const faltantes  = c.pagos_faltantes || 0;
  const hechos     = totalPagos - faltantes;
  const vendNombre = vendedores.find(v => v.id === c.cv_usuario)?.nombre || c.nombre_vendedor || "";

  cont.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
      <div style="width:48px;height:48px;border-radius:50%;flex-shrink:0;
                  background:${estadoInfo.color};color:#fff;font-size:20px;
                  display:flex;align-items:center;justify-content:center;font-weight:900">
        ${nombre.charAt(0).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:17px">${esc(nombre)}</div>
        <div style="font-size:12px;color:var(--txt2)">
          📍 ${esc(c.colonia || c.direccion_completa || "—")}
        </div>
        ${vendNombre ? `<div style="font-size:11px;color:var(--txt2);margin-top:2px">
          👤 Vendedor: ${esc(vendNombre)}</div>` : ""}
      </div>
      <span style="background:${estadoInfo.color};color:#fff;font-size:10px;
                   font-weight:800;padding:4px 10px;border-radius:100px;flex-shrink:0">
        ${estadoInfo.icono} ${estadoInfo.label}
      </span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="text-align:center;background:var(--bg2,#f8f8f8);border-radius:12px;padding:10px">
        <div style="font-size:15px;font-weight:900;color:${estadoInfo.color}">
          ${money(c.saldo || 0)}
        </div>
        <div style="font-size:10px;color:var(--txt2)">Saldo</div>
      </div>
      <div style="text-align:center;background:var(--bg2,#f8f8f8);border-radius:12px;padding:10px">
        <div style="font-size:15px;font-weight:900">${hechos}/${totalPagos}</div>
        <div style="font-size:10px;color:var(--txt2)">Pagos</div>
      </div>
      <div style="text-align:center;background:var(--bg2,#f8f8f8);border-radius:12px;padding:10px">
        <div style="font-size:15px;font-weight:900;
                    color:${venc.diasRestantes < 0 ? "#E53935" : "inherit"}">
          ${venc.diasRestantes < 0
            ? Math.abs(venc.diasRestantes) + "d"
            : (venc.diasRestantes || 0) + "d"}
        </div>
        <div style="font-size:10px;color:var(--txt2)">
          ${venc.diasRestantes < 0 ? "Atraso" : "Restantes"}
        </div>
      </div>
    </div>

    <div style="font-size:13px;color:var(--txt2);margin-bottom:14px">
      🛋️ ${esc(c.producto || (Array.isArray(c.items) && c.items[0]?.nombre) || "—")}
    </div>

    <div style="display:flex;gap:8px">
      ${c.telefono ? `
        <a href="tel:${c.telefono}" class="btn btn-ghost" style="flex:1;text-decoration:none">
          📞 Llamar
        </a>
        <a href="https://wa.me/52${c.telefono}" target="_blank" class="btn btn-green"
           style="flex:1;text-decoration:none">
          💬 WhatsApp
        </a>` : ""}
      <button class="btn btn-primary" id="btn-ir-cobro" style="flex:1">
        💵 Cobrar
      </button>
    </div>
  `;

  cont.querySelector("#btn-ir-cobro")?.addEventListener("click", async () => {
    const { navega } = await import("../router.js");
    navega("detalle-cobro", { id: c.id });
  });

  panel.classList.remove("hidden");
}
