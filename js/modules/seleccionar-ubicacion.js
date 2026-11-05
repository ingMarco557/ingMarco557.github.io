/* ============================================================
   modules/seleccionar-ubicacion.js · Ubicación con restricción a Comitán
   ------------------------------------------------------------
   - Carga Google Maps (ya incluido en el crédito gratuito)
   - Restringe el área a Comitán de Domínguez usando polígono
   - Validación Point-in-Polygon: 0 llamadas extra a la API
   ============================================================ */

import { toast } from "../ui.js";
import { navega, volver } from "../router.js";
import { cargarGoogleMaps } from "../maps-loader.js";
import { getPerfil, esGerente } from "../auth.js";
import { getColoniasVendedor } from "../data.js";
import { COLONIAS_COMITAN } from "../colonias-comitan.js";

const COMITAN = { lat: 16.2521, lng: -92.1333 };

/* ─── POLÍGONO DEL MUNICIPIO DE COMITÁN DE DOMÍNGUEZ ────────
   Basado en coordenadas extremas oficiales (Wikipedia/INEGI):
   Norte: 16°35' | Sur: 16°00' | Este: 91°59' | Oeste: 92°22'
   Bounding box INEGI: 16.013685, -92.353172, 16.569198, -91.996682
   El polígono sigue la forma aproximada del municipio. ────── */
const POLIGONO_COMITAN = [
  // Esquina NO — límite con Las Rosas y Socoltenango
  [16.583, -92.370],
  // Norte — límite con Amatenango del Valle
  [16.569, -92.300],
  [16.560, -92.220],
  [16.555, -92.160],
  // NE — límite con Chanal y Las Margaritas
  [16.540, -92.100],
  [16.510, -92.030],
  [16.490, -92.000],
  // Este — límite con Las Margaritas e Independencia
  [16.450, -91.997],
  [16.400, -92.000],
  [16.350, -92.010],
  [16.300, -92.015],
  // SE — límite con La Trinitaria
  [16.250, -92.020],
  [16.200, -92.030],
  [16.150, -92.060],
  [16.100, -92.080],
  // Sur — límite con La Trinitaria y Tzimol
  [16.020, -92.100],
  [16.014, -92.150],
  [16.014, -92.220],
  // SO — límite con Tzimol y Socoltenango
  [16.040, -92.280],
  [16.080, -92.320],
  [16.120, -92.353],
  // Oeste — límite con Las Rosas
  [16.200, -92.353],
  [16.280, -92.340],
  [16.350, -92.330],
  [16.420, -92.350],
  [16.480, -92.360],
  // Volver al inicio
  [16.583, -92.370]
];

/* ─── POINT-IN-POLYGON (Ray Casting) ─────────────────────────
   Verifica si un punto [lat, lng] está dentro del polígono.
   Algoritmo puro — cero llamadas a ninguna API. ─────────────── */
function estaDentroDeComitan(lat, lng) {
  const poly = POLIGONO_COMITAN;
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      dentro = !dentro;
    }
  }
  return dentro;
}

let map      = null;
let marcador = null;
let poligonoOverlay = null;
let seleccion = { lat: null, lng: null };

export async function render(root, params) {
  seleccion = { lat: null, lng: null };
  const volverA = (params && params.volverA) || "datos-cliente";

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-cancelar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Ubicación del cliente</h1>
    </div>

    <div style="padding:10px 16px 6px;display:flex;align-items:center;gap:8px">
      <div style="background:#E3F2FD;border-radius:10px;padding:8px 12px;
                  flex:1;font-size:13px;color:#1565C0;font-weight:500">
        <span id="tv-instruccion">
          📍 Toca el mapa para marcar la casa del cliente
        </span>
      </div>
    </div>

    <!-- Aviso de zona -->
    <div style="padding:0 16px 8px">
      <div style="background:#FFF8E1;border-radius:10px;padding:7px 12px;
                  font-size:11px;color:#F57C00;font-weight:600;
                  display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Solo se permiten ubicaciones dentro de Comitán de Domínguez
      </div>
    </div>

    <div id="map-picker" style="width:100%;height:calc(100vh - 220px);min-height:300px"></div>

    <div style="padding:10px 16px;display:flex;gap:10px;
                background:#fff;box-shadow:0 -2px 10px rgba(0,0,0,0.08)">
      <button class="btn btn-ghost" id="btn-cancelar2" style="flex:1">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirmar" style="flex:2;font-weight:800">
        ✓ Confirmar ubicación
      </button>
    </div>
  `;

  root.querySelector("#btn-cancelar").addEventListener("click", volver);
  root.querySelector("#btn-cancelar2").addEventListener("click", volver);

  root.querySelector("#btn-confirmar").addEventListener("click", async () => {
    if (!seleccion.lat || !seleccion.lng) {
      toast("Toca el mapa para marcar la ubicación", "warn");
      return;
    }

    // Si el vendedor tiene colonias asignadas, verificar que la colonia
    // del cliente esté dentro de su zona
    if (!esGerente()) {
      try {
        const perfil = await getPerfil();
        const coloniasVendedor = await getColoniasVendedor(perfil.uid);
        if (coloniasVendedor && coloniasVendedor.length > 0) {
          // El vendedor tiene zona restringida — verificar contra la colonia
          // que el usuario escribió en datos-cliente (se pasa en params)
          const coloniaCliente = (params?.colonia || "").toLowerCase();
          if (coloniaCliente) {
            const coloniaEnZona = COLONIAS_COMITAN.find(c =>
              coloniasVendedor.includes(c.id) &&
              (coloniaCliente.includes(c.nombre.toLowerCase()) ||
               c.nombre.toLowerCase().includes(coloniaCliente))
            );
            if (!coloniaEnZona) {
              const nombresZona = COLONIAS_COMITAN
                .filter(c => coloniasVendedor.includes(c.id))
                .map(c => c.nombre)
                .join(", ");
              toast(`Esta colonia no está en tu zona asignada. Tu zona: ${nombresZona}`, "warn");
              return;
            }
          }
        }
      } catch (e) { console.warn("validación zona:", e); }
    }

    navega(volverA, {
      volverDeMapa: true,
      lat: seleccion.lat,
      lng: seleccion.lng
    });
  });

  try {
    await cargarGoogleMaps();
    inicializarMapa(root);
  } catch (e) {
    console.error(e);
    root.querySelector("#map-picker").innerHTML = `
      <div class="empty-state">
        <div style="font-size:40px;margin-bottom:10px">🗺️</div>
        No se pudo cargar el mapa.<br>
        <small>Revisa la conexión a internet.</small>
      </div>`;
  }
}

function inicializarMapa(root) {
  const cont = root.querySelector("#map-picker");

  map = new google.maps.Map(cont, {
    center: COMITAN,
    zoom: 12,
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    // Restringir el viewport al bounding box del municipio
    restriction: {
      latLngBounds: {
        north: 16.590,
        south: 16.010,
        east: -91.990,
        west: -92.370
      },
      strictBounds: false
    }
  });

  // Dibujar el polígono del municipio sobre el mapa
  poligonoOverlay = new google.maps.Polygon({
    paths: POLIGONO_COMITAN.map(([lat, lng]) => ({ lat, lng })),
    strokeColor: "#1565C0",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#1565C0",
    fillOpacity: 0.07,
    map
  });

  const instruccion = root.querySelector("#tv-instruccion");

  map.addListener("click", (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Validar que esté dentro de Comitán
    if (!estaDentroDeComitan(lat, lng)) {
      toast("Esa ubicación está fuera de Comitán de Domínguez", "warn");

      // Efecto visual — marcador rojo temporal
      const marcadorFuera = new google.maps.Marker({
        position: e.latLng,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#E53935",
          fillOpacity: 0.8,
          strokeColor: "#B71C1C",
          strokeWeight: 2
        },
        title: "Fuera de zona"
      });
      setTimeout(() => marcadorFuera.setMap(null), 1500);
      return;
    }

    // Ubicación válida dentro de Comitán
    seleccion = { lat, lng };

    if (marcador) {
      marcador.setPosition(e.latLng);
    } else {
      marcador = new google.maps.Marker({
        position: e.latLng,
        map,
        title: "Casa del cliente",
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: "#1565C0",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2
        }
      });
    }

    instruccion.innerHTML =
      `✅ Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)} — Toca Confirmar`;
    instruccion.parentElement.style.background = "#E8F5E9";
    instruccion.parentElement.style.color = "#2E7D32";
  });
}
