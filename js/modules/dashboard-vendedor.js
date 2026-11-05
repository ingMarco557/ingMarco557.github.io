/* ============================================================
   modules/dashboard-vendedor.js · Dashboard del vendedor
   ------------------------------------------------------------
   Muestra al vendedor:
   - Su cartera (total, usado, disponible)
   - Sus clientes activos con saldo pendiente
   - Total por recuperar
   - Total ya cobrado
   - IVA desglosado
   NO muestra ganancias (eso solo el gerente).
   ============================================================ */

import { getEstadisticasVendedor } from "../data.js";
import { getPerfil } from "../auth.js";
import { money, esc, toast } from "../ui.js";
import { volver, navega } from "../router.js";

export async function render(root) {
  const perfil = await getPerfil();
  if (!perfil) {
    toast("Sesión caducada", "err");
    volver();
    return;
  }

  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Mi Dashboard</h1>
    </div>
    <div class="screen-pad" id="cont-dash">
      <div class="skeleton" style="height:100px;margin-bottom:14px"></div>
      <div class="skeleton" style="height:200px;margin-bottom:14px"></div>
      <div class="skeleton" style="height:150px"></div>
    </div>
  `;

  root.querySelector("#btn-back").addEventListener("click", volver);

  try {
    const est = await getEstadisticasVendedor(perfil.uid);
    pintarDashboardVendedor(root, est, perfil.nombre);
  } catch (e) {
    console.error(e);
    root.querySelector("#cont-dash").innerHTML = `
      <div class="empty-state"><div class="es-icon">⚠️</div>Error al cargar datos.</div>`;
  }
}

function pintarDashboardVendedor(root, e, nombre) {
  const cont = root.querySelector("#cont-dash");
  const pct = e.cartera > 0 ? Math.round((e.usado / e.cartera) * 100) : 0;
  const pctRecup =
    e.totalPrestado > 0
      ? Math.round((e.totalCobrado / e.totalPrestado) * 100)
      : 0;

  cont.innerHTML = `
    <!-- CARTERA -->
    <div class="card" style="background:linear-gradient(135deg,var(--azul),var(--azul-osc));color:#fff;border:none">
      <div style="opacity:.85;font-size:12px;font-weight:700;text-transform:uppercase">
        💼 Mi cartera
      </div>
      <div style="font-size:26px;font-weight:900;margin:6px 0">${money(e.cartera)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;opacity:.85">Usado</div>
          <div style="font-size:16px;font-weight:800;color:#FF8A80">${money(e.usado)}</div>
        </div>
        <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;opacity:.85">Disponible</div>
          <div style="font-size:16px;font-weight:800;color:#B9F6CA">${money(e.disponible)}</div>
        </div>
      </div>
      <!-- Barra de uso de cartera -->
      <div style="background:rgba(255,255,255,.2);height:8px;border-radius:100px;overflow:hidden;margin-top:12px">
        <div style="background:#FF8A80;height:100%;width:${pct}%;transition:width 1s;border-radius:100px"></div>
      </div>
      <div style="font-size:11px;opacity:.75;margin-top:4px">${pct}% de cartera utilizada</div>
    </div>

    <!-- RESUMEN DE COBRANZA -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      ${miniCard("📤 Por recuperar", money(e.totalPorRecuperar), "var(--rojo)")}
      ${miniCard("📥 Ya cobrado", money(e.totalCobrado), "var(--verde)")}
      ${miniCard("👥 Clientes", e.totalClientes, "var(--azul)")}
      ${miniCard("📊 Recuperado", pctRecup + "%", "var(--naranja)")}
    </div>

    <!-- EFECTIVO EN POSESIÓN -->
    ${
      (e.efectivoPendiente || 0) > 0
        ? `
    <div style="background:linear-gradient(135deg,#2E7D32,#388E3C);border-radius:16px;
                padding:16px 20px;margin-bottom:14px;color:#fff;
                box-shadow:0 4px 16px rgba(46,125,50,0.3)">
      <div style="font-size:11px;font-weight:700;opacity:.8;letter-spacing:1px;margin-bottom:4px">
        💵 EFECTIVO EN TU POSESIÓN
      </div>
      <div style="font-size:26px;font-weight:900">${money(e.efectivoPendiente)}</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px">
        Dinero cobrado pendiente de entregar al gerente
      </div>
    </div>`
        : ""
    }

    <!-- BARRA DE RECUPERACIÓN -->
    <div class="card">
      <div class="card-title">Recuperación de cartera</div>
      <div style="background:var(--line);height:12px;border-radius:100px;overflow:hidden;margin:8px 0">
        <div style="background:linear-gradient(90deg,var(--verde),#69F0AE);height:100%;width:${pctRecup}%;transition:width 1s;border-radius:100px"></div>
      </div>
      <div class="row-between muted" style="font-size:12px">
        <span>Cobrado ${money(e.totalCobrado)}</span>
        <span>Meta ${money(e.totalPrestado)}</span>
      </div>
    </div>

    <!-- IVA -->
    <div class="card" style="background:#FFF8E1;border-color:#FFE082">
      <div class="card-title" style="color:#F57F17">🧾 IVA de tu cartera</div>
      <div class="sim-row">
        <span>Total prestado</span><strong>${money(e.totalPrestado)}</strong>
      </div>
      <div class="sim-row">
        <span>Base (sin IVA)</span><strong>${money(e.baseIVA)}</strong>
      </div>
      <div class="sim-row">
        <span>IVA 16%</span>
        <strong style="color:var(--naranja)">${money(e.montoIVA)}</strong>
      </div>
    </div>

    <!-- MIS CLIENTES -->
    <div class="card">
      <div class="card-title">👥 Mis clientes activos</div>
      ${
        e.clientesActivos.length === 0
          ? `<p class="muted text-center" style="padding:14px 0">No tienes clientes activos</p>`
          : e.clientesActivos
              .map(
                (c, i) => `
          <div class="row-between" data-id="${c.id}"
               style="padding:10px 0;border-bottom:${i < e.clientesActivos.length - 1 ? "1px solid var(--line)" : "none"};cursor:pointer">
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14px">${esc(c.nombre)}</div>
              <div class="muted" style="font-size:12px">${esc(c.producto)}</div>
              <div style="font-size:11px;color:var(--verde)">Cobrado: ${money(c.cobrado)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-left:12px">
              <div style="font-weight:800;color:var(--rojo);font-size:14px">${money(c.saldo)}</div>
              <div class="muted" style="font-size:11px">por cobrar</div>
            </div>
          </div>
        `,
              )
              .join("")
      }
    </div>
  `;

  // Al tocar un cliente, ir a su detalle de cobro
  cont.querySelectorAll("[data-id]").forEach((item) => {
    item.addEventListener("click", () => {
      const cliente = e.clientesActivos.find((c) => c.id === item.dataset.id);
      if (cliente) navega("detalle-cobro", { cliente });
    });
  });
}

function miniCard(titulo, valor, color) {
  return `
    <div style="background:#fff;border:1px solid var(--line);border-radius:var(--r-md);padding:14px">
      <div class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">${titulo}</div>
      <div style="color:${color};font-size:18px;font-weight:900;margin-top:6px">${valor}</div>
    </div>`;
}
