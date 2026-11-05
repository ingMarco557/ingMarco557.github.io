/* ============================================================
   modules/dashboard.js — Dashboard Gerente v3
   Gráficas Canvas animadas + clientes por vendedor
   ============================================================ */

import {
  getEstadisticasGlobalesConIVA,
  getCarteraPorVendedor,
  getPagosMensualesGlobal,
  getClientesActivos
} from "../data.js";
import { money, esc } from "../ui.js";
import { volver, navega } from "../router.js";
import { calcularVencimiento } from "../vencimientos.js";

export async function render(root) {
  root.innerHTML = `
    <div class="topbar">
      <button class="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>Dashboard</h1>
    </div>
    <div class="tab-row" style="margin:0 16px 0">
      <button class="tab-btn active" id="tab-general">📊 General</button>
      <button class="tab-btn" id="tab-vendedores">👥 Vendedores</button>
    </div>
    <div id="dash-content" class="screen-pad">
      <div style="text-align:center;padding:40px;color:var(--txt2)">
        <div style="font-size:32px;margin-bottom:10px">📊</div>Cargando...
      </div>
    </div>`;

  root.querySelector("#btn-back").addEventListener("click", volver);

  const tabG = root.querySelector("#tab-general");
  const tabV = root.querySelector("#tab-vendedores");
  const cont = root.querySelector("#dash-content");
  let tabActivo = "general";

  tabG.addEventListener("click", async () => {
    if (tabActivo === "general") return;
    tabActivo = "general";
    tabG.classList.add("active"); tabV.classList.remove("active");
    await renderGeneral(cont);
  });
  tabV.addEventListener("click", async () => {
    if (tabActivo === "vendedores") return;
    tabActivo = "vendedores";
    tabV.classList.add("active"); tabG.classList.remove("active");
    await renderVendedores(cont);
  });

  await renderGeneral(cont);
}

/* ══════════════════════════════════════════════════════════
   GRÁFICA DE BARRAS CON CANVAS — animada
   ══════════════════════════════════════════════════════════ */
function dibujarBarras(canvasId, datos, opciones = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width  = canvas.offsetWidth  || 340;
  const H = canvas.height = canvas.offsetHeight || 180;

  const {
    colorBarra    = "#1976D2",
    colorBarraMax = "#2E7D32",
    colorNeg      = "#E53935",
    meta          = 0,
    labels        = [],
    duracion      = 900
  } = opciones;

  const padL = 10, padR = 10, padT = 30, padB = 32;
  const maxVal = Math.max(...datos.map(Math.abs), meta, 1);
  const barW   = (W - padL - padR) / datos.length - 6;
  let inicio   = null;

  function frame(ts) {
    if (!inicio) inicio = ts;
    const prog = Math.min((ts - inicio) / duracion, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - prog, 3);

    ctx.clearRect(0, 0, W, H);

    // Línea de meta
    if (meta > 0) {
      const yMeta = padT + (H - padT - padB) * (1 - meta / maxVal);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#FFA726";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(padL, yMeta); ctx.lineTo(W - padR, yMeta); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#FFA726";
      ctx.font = "9px sans-serif";
      ctx.fillText("Meta", W - padR - 28, yMeta - 3);
    }

    datos.forEach((val, i) => {
      const x    = padL + i * ((W - padL - padR) / datos.length) + 3;
      const area = H - padT - padB;
      const h    = (Math.abs(val) / maxVal) * area * ease;
      const y    = padT + area - h;

      // Color según valor y si es el máximo
      const esMayor = val === Math.max(...datos);
      const color   = val < 0 ? colorNeg : esMayor ? colorBarraMax : colorBarra;

      // Barra con gradiente
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + "88");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, [5, 5, 0, 0]);
      ctx.fill();

      // Valor encima
      if (prog > 0.7 && val !== 0) {
        ctx.fillStyle = esMayor ? colorBarraMax : (val < 0 ? colorNeg : "#333");
        ctx.font = `bold 9px sans-serif`;
        ctx.textAlign = "center";
        const txt = moneyCorto(val);
        ctx.fillText(txt, x + barW / 2, y - 3);
      }

      // Label debajo
      ctx.fillStyle = "#888";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels[i] || "", x + barW / 2, H - padB + 14);
    });

    if (prog < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/* ══════════════════════════════════════════════════════════
   TAB GENERAL
   ══════════════════════════════════════════════════════════ */
async function renderGeneral(cont) {
  cont.innerHTML = cargando();
  try {
    const [est, meses] = await Promise.all([
      getEstadisticasGlobalesConIVA(),
      getPagosMensualesGlobal()
    ]);

    // Normalizar campos
    est.carteraTotal = est.carteraTotal || est.totalPrestado    || 0;
    est.cobradoTotal = est.cobradoTotal || est.totalCobrado     || 0;
    est.porCobrar    = Math.max(0, est.carteraTotal - est.cobradoTotal);
    est.pendientes   = est.solicitudesPendientes || 0;
    est.aprobados    = est.creditosAprobados     || 0;
    est.entregados   = est.clientesActivos       || 0;
    est.liquidados   = est.creditosLiquidados    || 0;

    const pct = est.carteraTotal > 0
      ? Math.round((est.cobradoTotal / est.carteraTotal) * 100) : 0;

    const mesActual     = new Date().getMonth();
    const mesesRestantes = 11 - mesActual;
    const ultimos3      = meses.slice(-3).reduce((a, m) => a + m.total, 0) / 3;
    const proyeccion    = Math.round(ultimos3 * mesesRestantes);

    cont.innerHTML = `
      <!-- TARJETAS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
        ${card("💼","CARTERA TOTAL",  money(est.carteraTotal), "#1565C0")}
        ${card("✅","COBRADO",        money(est.cobradoTotal), "#2E7D32")}
        ${card("⏳","POR COBRAR",     money(est.porCobrar),   "#E65100")}
        ${card("📈","RECUPERADO",     pct+"%",                "#6A1B9A")}
      </div>

      <!-- BARRA RECUPERACIÓN ANIMADA -->
      <div class="card" style="margin-bottom:18px">
        <div style="font-weight:700;font-size:14px;margin-bottom:10px">
          Recuperación de cartera
        </div>
        <div style="background:#e0e0e0;border-radius:100px;height:22px;overflow:hidden">
          <div id="barra-rec" style="background:linear-gradient(90deg,#2E7D32,#66BB6A);
               height:100%;width:0%;border-radius:100px;
               transition:width 1.4s cubic-bezier(.34,1.2,.64,1);
               display:flex;align-items:center;justify-content:flex-end;padding-right:10px">
            <span style="color:#fff;font-size:11px;font-weight:900">
              ${pct > 12 ? pct+"%" : ""}
            </span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;
                    color:var(--txt2);margin-top:5px">
          <span>${money(est.cobradoTotal)} cobrado</span>
          <span>Meta ${money(est.carteraTotal)}</span>
        </div>
      </div>

      <!-- GRÁFICA CANVAS MENSUAL -->
      <div class="card" style="margin-bottom:18px">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px">
          💰 Cobrado por mes
        </div>
        <div style="font-size:11px;color:var(--txt2);margin-bottom:12px">
          Últimos 6 meses — barra verde = mes más alto
        </div>
        <canvas id="canvas-general"
                style="width:100%;height:180px;display:block"></canvas>
      </div>

      <!-- PROYECCIÓN -->
      <div class="card" style="margin-bottom:18px;
           background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff">
        <div style="font-size:10px;font-weight:700;opacity:.8;letter-spacing:1px;margin-bottom:4px">
          📅 PROYECCIÓN RESTO DEL AÑO
        </div>
        <div style="font-size:26px;font-weight:900">${money(proyeccion)}</div>
        <div style="font-size:11px;opacity:.85;margin-top:4px">
          Promedio 3 meses × ${mesesRestantes} meses restantes
        </div>
      </div>

      <!-- ESTADO CRÉDITOS -->
      <div class="card" style="margin-bottom:18px">
        <div style="font-weight:700;font-size:14px;margin-bottom:12px">
          📋 Estado de créditos
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[
            ["Pendientes", est.pendientes, "#F57C00"],
            ["Aprobados",  est.aprobados,  "#1976D2"],
            ["Activos",    est.entregados, "#2E7D32"],
            ["Liquidados", est.liquidados, "#7B1FA2"]
          ].map(([l,v,c]) => `
            <div style="background:var(--bg2,#f8f8f8);border-radius:12px;
                        padding:12px;text-align:center">
              <div style="font-size:26px;font-weight:900;color:${c}">${v}</div>
              <div style="font-size:11px;color:var(--txt2)">${l}</div>
            </div>`).join("")}
        </div>
      </div>

      <!-- TOP VENDEDORES -->
      ${est.topVendedores?.length ? `
      <div class="card" style="margin-bottom:18px">
        <div style="font-weight:700;font-size:14px;margin-bottom:12px">
          🏆 Top vendedores
        </div>
        ${est.topVendedores.slice(0,5).map((v,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
                      ${i<4?"border-bottom:1px solid var(--line)":""}">
            <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;
                        background:${["#FFD700","#C0C0C0","#CD7F32","#1976D2","#2E7D32"][i]};
                        color:${i<3?"#212121":"#fff"};font-weight:900;font-size:12px;
                        display:flex;align-items:center;justify-content:center">${i+1}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">${esc(v.nombre)}</div>
              <div style="font-size:11px;color:var(--txt2)">
                ${money(v.total||v.totalVendido||0)} vendido
              </div>
            </div>
          </div>`).join("")}
      </div>` : ""}
    `;

    // Animar barra de recuperación
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const b = cont.querySelector("#barra-rec");
      if (b) b.style.width = pct + "%";
    }));

    // Dibujar gráfica canvas
    setTimeout(() => {
      dibujarBarras("canvas-general",
        meses.map(m => m.total),
        { labels: meses.map(m => m.label), duracion: 1000 }
      );
    }, 100);

  } catch(e) { cont.innerHTML = errorMsg(e.message); }
}

/* ══════════════════════════════════════════════════════════
   TAB VENDEDORES — con clientes expandibles
   ══════════════════════════════════════════════════════════ */
async function renderVendedores(cont) {
  cont.innerHTML = cargando("Cargando vendedores...");
  try {
    const [vendedores, mesesG, todosClientes] = await Promise.all([
      getCarteraPorVendedor(),
      getPagosMensualesGlobal(),
      getClientesActivos(null, "gerente")
    ]);

    if (!vendedores.length) {
      cont.innerHTML = `<div style="text-align:center;padding:40px;color:var(--txt2)">
        No hay vendedores</div>`;
      return;
    }

    const sorted  = [...vendedores].sort((a,b) => b.porRecuperar - a.porRecuperar);
    const labels  = mesesG.map(m => m.label);
    const COLS    = ["#1565C0","#2E7D32","#E65100","#6A1B9A","#C62828","#0277BD","#558B2F","#AD1457"];

    const totalEfectivo  = vendedores.reduce((a,v) => a + v.efectivo, 0);
    const totalClientes  = vendedores.reduce((a,v) => a + v.clientesActivos, 0);
    const totalPorCobrar = vendedores.reduce((a,v) => a + v.porRecuperar, 0);
    const totalMoraMx    = vendedores.reduce((a,v) => a + (v.moraMaxima||0), 0);

    cont.innerHTML = `
      <!-- RESUMEN -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
        ${card("💵","EFECTIVO EN CAMPO",  money(totalEfectivo),    "#2E7D32")}
        ${card("👥","CLIENTES ACTIVOS",   totalClientes,           "#1565C0")}
        ${card("⏳","POR RECUPERAR",      money(totalPorCobrar),   "#E65100")}
        ${card("🚨","MORA MÁXIMA",        totalMoraMx+" clientes", "#B71C1C")}
      </div>

      <!-- GRÁFICA CANVAS COMPARATIVA ESTE MES -->
      <div class="card" style="margin-bottom:18px">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px">
          📊 Cobrado este mes por vendedor
        </div>
        <div style="font-size:11px;color:var(--txt2);margin-bottom:12px">
          ${labels[labels.length-1]||"Mes actual"} — rojo = sin cobros
        </div>
        <canvas id="canvas-vendedores" style="width:100%;height:180px;display:block"></canvas>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
          ${sorted.map((v,i) => `
            <div style="display:flex;align-items:center;gap:4px;font-size:10px">
              <div style="width:10px;height:10px;border-radius:2px;
                          background:${COLS[i%COLS.length]};flex-shrink:0"></div>
              <span>${esc(v.nombre)}</span>
            </div>`).join("")}
        </div>
      </div>

      <!-- TARJETAS POR VENDEDOR — expandibles -->
      <div id="lista-vendedores">
        ${sorted.map((v, i) => {
          const ultimaClave = Object.keys(v.pagosMes||{}).sort().pop();
          const montoMes    = (v.pagosMes||{})[ultimaClave] || 0;
          const sinCobros   = montoMes === 0;
          const pctUsado    = v.cartera > 0
            ? Math.min(Math.round((v.usado/v.cartera)*100), 100) : 0;
          const colorV      = COLS[i % COLS.length];

          return `
          <div class="card vendedor-card" data-vid="${v.id}" data-idx="${i}"
               style="margin-bottom:12px;cursor:pointer">

            <!-- Cabecera clickeable -->
            <div class="vendedor-header" data-vid="${v.id}"
                 style="display:flex;align-items:center;gap:12px">
              <div style="width:46px;height:46px;border-radius:50%;flex-shrink:0;
                          background:linear-gradient(135deg,${colorV},${COLS[(i+1)%COLS.length]});
                          color:#fff;font-size:20px;font-weight:900;
                          display:flex;align-items:center;justify-content:center">
                ${v.nombre.charAt(0).toUpperCase()}
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span style="font-weight:800;font-size:15px">${esc(v.nombre)}</span>
                  ${sinCobros ? `<span style="background:#FFEBEE;color:#C62828;
                    font-size:10px;font-weight:800;padding:2px 8px;border-radius:100px">
                    ⚠️ Sin cobros este mes</span>` : ""}
                  ${(v.moraMaxima||0) > 0 ? `<span style="background:#B71C1C;color:#fff;
                    font-size:10px;font-weight:800;padding:2px 8px;border-radius:100px">
                    🚨 ${v.moraMaxima} mora</span>` : ""}
                </div>
                <div style="font-size:12px;color:var(--txt2)">${v.clientesActivos} clientes</div>
              </div>
              <svg class="chevron-${v.id}" viewBox="0 0 24 24" width="18" height="18"
                   fill="none" stroke="currentColor" stroke-width="2.5"
                   style="flex-shrink:0;transition:transform .3s;color:var(--txt2)">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>

            <!-- Métricas -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;
                        gap:8px;margin:12px 0">
              <div style="text-align:center;background:#E8F5E9;border-radius:10px;padding:8px">
                <div style="font-size:12px;font-weight:900;color:#2E7D32">
                  ${money(v.efectivo)}
                </div>
                <div style="font-size:9px;color:#2E7D32;font-weight:600">💵 Efectivo</div>
              </div>
              <div style="text-align:center;background:${sinCobros?"#FFEBEE":"#FFF3E0"};
                          border-radius:10px;padding:8px">
                <div style="font-size:12px;font-weight:900;
                            color:${sinCobros?"#C62828":"#E65100"}">
                  ${money(montoMes)}
                </div>
                <div style="font-size:9px;font-weight:600;
                            color:${sinCobros?"#C62828":"#E65100"}">
                  📅 Este mes
                </div>
              </div>
              <div style="text-align:center;background:#E3F2FD;border-radius:10px;padding:8px">
                <div style="font-size:12px;font-weight:900;color:#1565C0">
                  ${money(v.porRecuperar)}
                </div>
                <div style="font-size:9px;color:#1565C0;font-weight:600">⏳ Por cobrar</div>
              </div>
            </div>

            <!-- Mini gráfica canvas -->
            <canvas id="mini-${v.id}"
                    style="width:100%;height:60px;display:block;margin-bottom:8px"></canvas>

            <!-- Cartera usada -->
            <div style="font-size:11px;display:flex;justify-content:space-between;
                        margin-bottom:4px">
              <span style="color:var(--txt2)">Cartera usada</span>
              <span style="font-weight:700;color:${pctUsado>80?"#C62828":"inherit"}">
                ${pctUsado}%
              </span>
            </div>
            <div style="background:#e0e0e0;border-radius:100px;height:8px;
                        overflow:hidden;margin-bottom:12px">
              <div style="height:100%;width:${pctUsado}%;
                          background:${pctUsado>80?"linear-gradient(90deg,#C62828,#EF5350)":
                            `linear-gradient(90deg,${colorV},${COLS[(i+1)%COLS.length]})`};
                          border-radius:100px">
              </div>
            </div>

            <!-- Panel de clientes (colapsado por defecto) -->
            <div id="clientes-${v.id}" style="display:none">
              <div style="border-top:1px solid var(--line);padding-top:12px;
                          font-weight:700;font-size:13px;margin-bottom:10px">
                👥 Clientes de ${esc(v.nombre)}
              </div>
              <div id="lista-cli-${v.id}">
                <div style="text-align:center;color:var(--txt2);font-size:12px;padding:10px">
                  Cargando clientes...
                </div>
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>
    `;

    // Dibujar gráfica comparativa
    setTimeout(() => {
      const datos  = sorted.map(v => {
        const k = Object.keys(v.pagosMes||{}).sort().pop();
        return (v.pagosMes||{})[k] || 0;
      });
      dibujarBarras("canvas-vendedores", datos, {
        labels:     sorted.map(v => v.nombre.split(" ")[0]),
        colorBarra: "#1976D2",
        colorNeg:   "#E53935",
        duracion:   1000
      });

      // Mini gráficas por vendedor
      sorted.forEach((v, i) => {
        const vals = Object.entries(v.pagosMes||{}).sort()
          .map(([,val]) => val);
        dibujarBarras(`mini-${v.id}`, vals, {
          labels:        labels,
          colorBarra:    COLS[i%COLS.length],
          colorBarraMax: "#2E7D32",
          colorNeg:      "#E53935",
          duracion:      800
        });
      });
    }, 150);

    // Expandir/colapsar clientes al tocar la cabecera
    cont.querySelectorAll(".vendedor-header").forEach(hdr => {
      hdr.addEventListener("click", async () => {
        const vid    = hdr.dataset.vid;
        const panel  = cont.querySelector(`#clientes-${vid}`);
        const chev   = cont.querySelector(`.chevron-${vid}`);
        const abierto = panel.style.display !== "none";

        panel.style.display = abierto ? "none" : "block";
        if (chev) chev.style.transform = abierto ? "" : "rotate(180deg)";

        if (!abierto) {
          // Cargar clientes de este vendedor
          const listaCli = cont.querySelector(`#lista-cli-${vid}`);
          const clientesVend = todosClientes.filter(c => c.cv_usuario === vid);

          if (clientesVend.length === 0) {
            listaCli.innerHTML = `<div style="text-align:center;color:var(--txt2);
              font-size:12px;padding:10px">Sin clientes activos</div>`;
            return;
          }

          listaCli.innerHTML = clientesVend.map(c => {
            const nombre = `${c.nombre||""} ${c.apePat||""}`.trim();
            const venc   = calcularVencimiento(c);
            const colVenc = {
              vencido:    { bg:"#FFEBEE", txt:"#C62828", label:"VENCIDO" },
              urgente:    { bg:"#FFF3E0", txt:"#E65100", label:"URGENTE" },
              porVencer:  { bg:"#FFF9C4", txt:"#F57F17", label:"Por vencer" },
              alCorriente:{ bg:"#E8F5E9", txt:"#2E7D32", label:"Al corriente" },
              liquidado:  { bg:"#F3E5F5", txt:"#6A1B9A", label:"Liquidado" }
            }[venc.estado] || { bg:"#f5f5f5", txt:"#666", label:venc.estado };

            return `
              <div style="background:${colVenc.bg};border-radius:12px;
                          padding:10px 12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:13px;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      ${esc(nombre)}
                    </div>
                    <div style="font-size:11px;color:var(--txt2);margin-top:2px">
                      📍 ${esc(c.colonia||c.direccion_completa||"—")}
                    </div>
                  </div>
                  <span style="background:${colVenc.txt};color:#fff;font-size:9px;
                               font-weight:800;padding:3px 8px;border-radius:100px;
                               flex-shrink:0;margin-left:8px">
                    ${colVenc.label}
                  </span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;
                            gap:6px;margin-top:8px">
                  <div style="text-align:center">
                    <div style="font-size:12px;font-weight:800;color:${colVenc.txt}">
                      ${money(c.saldo||0)}
                    </div>
                    <div style="font-size:9px;color:var(--txt2)">Saldo</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-size:12px;font-weight:800">
                      ${money(c.monto_pago_sugerido || ((c.saldo||0)/(c.pagos_faltantes||1)))}
                    </div>
                    <div style="font-size:9px;color:var(--txt2)">Próx. pago</div>
                  </div>
                  <div style="text-align:center">
                    <div style="font-size:12px;font-weight:800;
                                color:${venc.diasRestantes < 0 ? "#C62828" : "inherit"}">
                      ${venc.diasRestantes < 0
                        ? Math.abs(venc.diasRestantes)+"d atraso"
                        : (venc.diasRestantes||0)+"d restantes"}
                    </div>
                    <div style="font-size:9px;color:var(--txt2)">Plazo</div>
                  </div>
                </div>
              </div>`;
          }).join("");
        }
      });
    });

  } catch(e) { cont.innerHTML = errorMsg(e.message); }
}

/* ── Helpers ─────────────────────────────────────────────── */
function card(ico, titulo, valor, color) {
  return `
    <div style="background:${color};border-radius:16px;padding:14px;color:#fff;
                box-shadow:0 4px 14px ${color}55">
      <div style="font-size:18px;margin-bottom:4px">${ico}</div>
      <div style="font-size:9px;font-weight:700;opacity:.8;letter-spacing:1px;margin-bottom:3px">
        ${titulo}
      </div>
      <div style="font-size:15px;font-weight:900;line-height:1.2">${valor}</div>
    </div>`;
}

function moneyCorto(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000000) return sign+"$"+(abs/1000000).toFixed(1)+"M";
  if (abs >= 1000)    return sign+"$"+(abs/1000).toFixed(1)+"k";
  return sign+"$"+Math.round(abs);
}

function cargando(txt="Cargando...") {
  return `<div style="text-align:center;padding:40px;color:var(--txt2)">
    <div style="font-size:32px;margin-bottom:10px">📊</div>${txt}</div>`;
}

function errorMsg(msg) {
  return `<div style="text-align:center;padding:30px;color:var(--txt2)">
    Error: ${msg}</div>`;
}
