/* ============================================================
   colonias-comitan.js
   Listado de colonias y barrios de Comitán de Domínguez
   Fuente: INEGI, MarketDataMéxico, PueblosAmérica
   Ordenadas por zonas para facilitar la asignación
   ============================================================ */

export const COLONIAS_COMITAN = [
  // ── CENTRO ─────────────────────────────────────────────
  { id: "centro",           nombre: "Centro Histórico",           zona: "Centro" },
  { id: "bel_dominguez",    nombre: "Barrio Belisario Domínguez", zona: "Centro" },
  { id: "san_jose",         nombre: "Barrio San José",            zona: "Centro" },
  { id: "san_sebastian",    nombre: "Barrio San Sebastián",       zona: "Centro" },
  { id: "san_agustin",      nombre: "Barrio San Agustín",         zona: "Centro" },
  { id: "cumpata",          nombre: "Barrio Cumpata",             zona: "Centro" },
  { id: "san_marcos",       nombre: "Barrio San Marcos",          zona: "Centro" },
  { id: "guadalupe",        nombre: "Barrio Guadalupe",           zona: "Centro" },

  // ── NORTE ──────────────────────────────────────────────
  { id: "linda_vista",      nombre: "Linda Vista",                zona: "Norte" },
  { id: "los_riegos",       nombre: "Los Riegos",                 zona: "Norte" },
  { id: "lazaro_cardenas",  nombre: "Lázaro Cárdenas",            zona: "Norte" },
  { id: "magisterial",      nombre: "Magisterial",                zona: "Norte" },
  { id: "insurgentes",      nombre: "Insurgentes",                zona: "Norte" },
  { id: "el_bosque",        nombre: "El Bosque",                  zona: "Norte" },
  { id: "bosques_comitan",  nombre: "Bosques de Comitán",         zona: "Norte" },
  { id: "los_angeles",      nombre: "Los Ángeles",                zona: "Norte" },
  { id: "desamparados",     nombre: "Los Desamparados",           zona: "Norte" },
  { id: "las_rosas_col",    nombre: "Las Rosas",                  zona: "Norte" },
  { id: "plan_de_ayala",    nombre: "Plan de Ayala",              zona: "Norte" },
  { id: "villa_las_rosas",  nombre: "Villa Las Rosas",            zona: "Norte" },

  // ── SUR ────────────────────────────────────────────────
  { id: "senor_pozo",       nombre: "Señor del Pozo",             zona: "Sur" },
  { id: "la_cueva",         nombre: "La Cueva",                   zona: "Sur" },
  { id: "pashton",          nombre: "Pashton Acapulco",           zona: "Sur" },
  { id: "latinoamericana",  nombre: "Latinoamericana",            zona: "Sur" },
  { id: "francisco_i_m",    nombre: "Francisco I. Madero",        zona: "Sur" },
  { id: "col_maya",         nombre: "Colonia Maya",               zona: "Sur" },
  { id: "revolucion",       nombre: "Revolución",                 zona: "Sur" },
  { id: "nuevo_horizonte",  nombre: "Nuevo Horizonte",            zona: "Sur" },
  { id: "santa_rosa",       nombre: "Santa Rosa",                 zona: "Sur" },
  { id: "los_pinos",        nombre: "Los Pinos",                  zona: "Sur" },

  // ── ORIENTE ────────────────────────────────────────────
  { id: "miguel_aleman",    nombre: "Miguel Alemán",              zona: "Oriente" },
  { id: "chacaljocom",      nombre: "Chacaljocom",                zona: "Oriente" },
  { id: "quija",            nombre: "Quijá",                      zona: "Oriente" },
  { id: "pablo_sidar",      nombre: "Pablo L. Sidar",             zona: "Oriente" },
  { id: "vicente_guerrero", nombre: "Vicente Guerrero",           zona: "Oriente" },
  { id: "20_noviembre",     nombre: "20 de Noviembre",            zona: "Oriente" },
  { id: "emiliano_zapata",  nombre: "Emiliano Zapata",            zona: "Oriente" },
  { id: "ob_reforma",       nombre: "Obrera y Reforma",           zona: "Oriente" },

  // ── PONIENTE ───────────────────────────────────────────
  { id: "bonampak",         nombre: "Bonampak",                   zona: "Poniente" },
  { id: "jantelha",         nombre: "Jantelha",                   zona: "Poniente" },
  { id: "la_floresta",      nombre: "La Floresta",                zona: "Poniente" },
  { id: "el_cedral",        nombre: "El Cedral",                  zona: "Poniente" },
  { id: "arboledas",        nombre: "Arboledas",                  zona: "Poniente" },
  { id: "tierra_nueva",     nombre: "Tierra Nueva",               zona: "Poniente" },
  { id: "paraiso",          nombre: "El Paraíso",                 zona: "Poniente" },

  // ── PERIFERIA / COMUNIDADES ────────────────────────────
  { id: "villahermosa",     nombre: "Villahermosa Yalumá",        zona: "Periferia" },
  { id: "san_jose_yoc",     nombre: "San José Yocnajab",          zona: "Periferia" },
  { id: "francisco_sar",    nombre: "Francisco Sarabia",          zona: "Periferia" },
  { id: "cash",             nombre: "Cash",                       zona: "Periferia" },
  { id: "efrain_gut",       nombre: "Efraín A. Gutiérrez",        zona: "Periferia" },
  { id: "zaragoza_mnt",     nombre: "Zaragoza la Montaña",        zona: "Periferia" },
  { id: "yaluma",           nombre: "Yalumá",                     zona: "Periferia" },
  { id: "los_llanos",       nombre: "Los Llanos",                 zona: "Periferia" },
];

/* Agrupa el listado por zona para mostrar secciones */
export function coloniasPorZona() {
  const grupos = {};
  for (const c of COLONIAS_COMITAN) {
    if (!grupos[c.zona]) grupos[c.zona] = [];
    grupos[c.zona].push(c);
  }
  return grupos;
}
