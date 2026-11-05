/* ============================================================
   data.js · Capa de acceso a datos
   ------------------------------------------------------------
   VERSIÓN con:
   - Fase A (dashboard, edición cliente, historial)
   - Creación automática de vendedores
   - *** DESCUENTO AUTOMÁTICO DE STOCK ***
       Al confirmar entrega (estatus 3): baja el stock.
       Al cancelar un crédito entregado: devuelve el stock.
   ============================================================ */

import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, increment, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { crearCuentaVendedor } from "./auth-admin.js";
import { calcularVencimiento } from "./vencimientos.js";
import { cacheGet, cacheSet, cacheInvalidar, cacheInvalidarVarios } from "./cache.js";

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ============================================================
   PRODUCTOS
   ============================================================ */
/* Clave única por día — cambia exactamente a medianoche */
function claveDia() {
  const hoy = new Date();
  return `productos_${hoy.getFullYear()}_${hoy.getMonth()}_${hoy.getDate()}`;
}

/* TTL en ms hasta la próxima medianoche */
function msPastaMedianoche() {
  const ahora = new Date();
  const medianoche = new Date(ahora);
  medianoche.setHours(24, 0, 0, 0);
  return medianoche - ahora;
}

export async function getProductos() {
  const clave = claveDia();

  // 1. localStorage con clave del día actual (más rápido que IndexedDB)
  try {
    const raw = localStorage.getItem("mx_prod_" + clave);
    if (raw) {
      const datos = JSON.parse(raw);
      if (Array.isArray(datos) && datos.length > 0) return datos;
    }
  } catch (_) {}

  // 2. IndexedDB (TTL 72h)
  const cached = await cacheGet("productos");
  if (cached && Array.isArray(cached) && cached.length > 0) {
    // Guardar también en localStorage para el día de hoy
    try {
      // Limpiar claves viejas de días anteriores
      Object.keys(localStorage)
        .filter(k => k.startsWith("mx_prod_") && k !== "mx_prod_" + clave)
        .forEach(k => localStorage.removeItem(k));
      // Guardar sin imágenes en localStorage para ahorrar espacio
      const sinImg = cached.map(({ imagen, imagen_base64, ...p }) => p);
      localStorage.setItem("mx_prod_" + clave, JSON.stringify(sinImg));
    } catch (_) {}
    return cached;
  }

  // 3. Firestore — última opción
  const snap = await getDocs(collection(db, "productos"));
  const datos = mapDocs(snap);

  // Guardar en IndexedDB (con imágenes, 72h)
  await cacheSet("productos", datos);

  // Guardar en localStorage sin imágenes (hasta medianoche)
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith("mx_prod_") && k !== "mx_prod_" + clave)
      .forEach(k => localStorage.removeItem(k));
    const sinImg = datos.map(({ imagen, imagen_base64, ...p }) => p);
    localStorage.setItem("mx_prod_" + clave, JSON.stringify(sinImg));
  } catch (_) {}

  return datos;
}

export async function getProductosAlmacen() {
  // Reutiliza caché de productos y ordena en memoria
  const prods = await getProductos();
  return [...prods].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

export function calcularPrecioVenta(costo) {
  // Margen variable según el costo (como define el manual técnico):
  // Costo < $2,000   → ×3.0  (margen 200%)
  // Costo < $10,000  → ×2.25 (margen 125%)
  // Costo >= $10,000 → ×1.4  (margen 40%)
  let factor;
  if (costo < 2000)       factor = 3.0;
  else if (costo < 10000) factor = 2.25;
  else                    factor = 1.4;
  return Math.round(costo * factor * 100) / 100;
}


/* actualizarProductoEnCache(id, datosNuevos)
   Actualiza solo un producto en la caché local (localStorage + IDB)
   sin necesidad de recargar los 207 productos de Firestore.
   El catálogo verá el cambio inmediatamente. */
async function actualizarProductoEnCache(id, datosNuevos) {
  try {
    // 1. Actualizar en IDB
    const cached = await cacheGet("productos");
    if (cached && Array.isArray(cached)) {
      const idx = cached.findIndex(p => p.id === id);
      if (idx >= 0) {
        cached[idx] = { ...cached[idx], ...datosNuevos };
      } else {
        cached.push({ id, ...datosNuevos }); // producto nuevo
      }
      await cacheSet("productos", cached);
    }

    // 2. Actualizar en localStorage del día
    const clave = "mx_prod_" + claveDia();
    try {
      const raw = localStorage.getItem(clave);
      if (raw) {
        const lista = JSON.parse(raw);
        const idx2 = lista.findIndex(p => p.id === id);
        const { imagen, imagen_base64, ...sinImg } = datosNuevos;
        if (idx2 >= 0) {
          lista[idx2] = { ...lista[idx2], ...sinImg };
        } else {
          lista.push({ id, ...sinImg });
        }
        localStorage.setItem(clave, JSON.stringify(lista));
      }
    } catch (_) {}
  } catch (_) {}
}

async function eliminarProductoDeCache(id) {
  try {
    // IDB
    const cached = await cacheGet("productos");
    if (cached && Array.isArray(cached)) {
      const nuevo = cached.filter(p => p.id !== id);
      await cacheSet("productos", nuevo);
    }
    // localStorage
    const clave = "mx_prod_" + claveDia();
    try {
      const raw = localStorage.getItem(clave);
      if (raw) {
        const lista = JSON.parse(raw).filter(p => p.id !== id);
        localStorage.setItem(clave, JSON.stringify(lista));
      }
    } catch (_) {}
  } catch (_) {}
}

export async function crearProducto({ nombre, categoria, descripcion, costo, stock, imagenUrl }) {
  const precio = calcularPrecioVenta(costo);
  const ref = await addDoc(collection(db, "productos"), {
    nombre, categoria, descripcion,
    costo, precio, stock,
    imagen: imagenUrl || "",
    creado: serverTimestamp()
  });
  await cacheInvalidar("productos"); // forzar recarga en la siguiente consulta
  return ref.id;
}

export async function editarProducto(id, { nombre, categoria, descripcion, costo, stock, imagenUrl }) {
  const datos = {
    nombre, categoria, descripcion,
    costo, precio: calcularPrecioVenta(costo), stock
  };
  if (imagenUrl) datos.imagen = imagenUrl;
  await updateDoc(doc(db, "productos", id), datos);
  await cacheInvalidar("productos"); // forzar recarga tras editar
}

export async function eliminarProducto(id) {
  await deleteDoc(doc(db, "productos", id));
  await cacheInvalidar("productos"); // forzar recarga tras eliminar
}

/* ============================================================
   *** FUNCIONES DE STOCK ***
   ============================================================ */

/* descontarStock(productos)
   Recibe un arreglo de { id, cantidad } y baja el stock de cada
   producto. Si un producto no tiene stock suficiente, descuenta
   lo que se pueda (no deja números negativos) y avisa.
   Devuelve un arreglo con los productos que quedaron sin stock
   suficiente, para poder avisar al usuario. */
export async function descontarStock(productos) {
  const sinStock = [];

  for (const item of productos) {
    if (!item.id || !item.cantidad) continue;

    const ref = doc(db, "productos", item.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue; // el producto fue borrado, lo ignoramos

    const stockActual = Number(snap.data().stock) || 0;
    const nuevoStock = stockActual - item.cantidad;

    if (nuevoStock < 0) {
      // No había suficiente: dejamos el stock en 0 y avisamos
      sinStock.push({
        nombre: snap.data().nombre,
        pedido: item.cantidad,
        habia: stockActual
      });
      await updateDoc(ref, { stock: 0 });
    } else {
      await updateDoc(ref, { stock: nuevoStock });
    }
  }

  return sinStock; // vacío si todo bajó bien
}

/* devolverStock(productos)
   Lo contrario: SUMA de nuevo las unidades al stock.
   Se usa cuando un crédito entregado se cancela/elimina. */
export async function devolverStock(productos) {
  for (const item of productos) {
    if (!item.id || !item.cantidad) continue;

    const ref = doc(db, "productos", item.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;

    const stockActual = Number(snap.data().stock) || 0;
    await updateDoc(ref, { stock: stockActual + item.cantidad });
  }
}

/* ============================================================
   CATEGORÍAS
   ============================================================ */
export async function getCategorias() {
  const cached = await cacheGet("categorias");
  if (cached) return cached;
  const snap = await getDocs(query(collection(db, "categorias"), orderBy("nombre")));
  const datos = mapDocs(snap);
  await cacheSet("categorias", datos);
  return datos;
}

/* ============================================================
   CRÉDITOS / SOLICITUDES
   ============================================================ */

/* crearSolicitudCompleta()
   AHORA guarda también "items": la lista completa de productos
   del carrito con sus cantidades. Esto permite descontar el
   stock correcto de CADA producto al confirmar la entrega. */
export async function crearSolicitudCompleta(datos) {
  const ref = await addDoc(collection(db, "creditos"), {
    ...datos,
    estatus: 1,
    saldo: datos.total_venta,
    pagos_faltantes: datos.total_pagos,
    stock_descontado: false,   // controla que no se descuente dos veces
    creado: serverTimestamp()
  });
  return ref.id;
}

export async function getEntregas(uid, rol) {
  const clave = `entregas_${uid}`;
  const cached = await cacheGet(clave, 3 * 60 * 1000); // 3 min
  if (cached) return cached;
  let q;
  if (String(rol).toLowerCase() === "gerente") {
    q = query(collection(db, "creditos"), where("estatus", "==", 1));
  } else {
    q = query(collection(db, "creditos"),
      where("cv_usuario", "==", uid), where("estatus", "==", 2));
  }
  const datos = mapDocs(await getDocs(q));
  await cacheSet(clave, datos);
  return datos;
}

export async function getDetalleCredito(id) {
  const snap = await getDoc(doc(db, "creditos", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* actualizarEstadoCredito()
   - Al APROBAR (estatus 2): sube el "usado" del vendedor.
   - Al ENTREGAR (estatus 3): descuenta stock + fecha entrega. */
export async function actualizarEstadoCredito(id, nuevoEstado) {
  const credRef = doc(db, "creditos", id);
  const snap = await getDoc(credRef);
  if (!snap.exists()) throw new Error("Crédito no encontrado");
  const credito = snap.data();
  let sinStock = [];

  if (nuevoEstado === 2) {
    await updateDoc(credRef, { estatus: 2 });
    if (credito.cv_usuario && credito.total_venta) {
      const vendRef = doc(db, "usuarios", credito.cv_usuario);
      const vendSnap = await getDoc(vendRef);
      if (vendSnap.exists()) {
        const usado = (vendSnap.data().usado || 0) + credito.total_venta;
        await updateDoc(vendRef, { usado });
      }
    }
  } else if (nuevoEstado === 3 && !credito.stock_descontado) {
    const items = obtenerItemsDelCredito(credito);
    if (items.length > 0) sinStock = await descontarStock(items);
    await updateDoc(credRef, {
      estatus: 3, stock_descontado: true,
      fecha_entrega: serverTimestamp()
    });
  } else {
    await updateDoc(credRef, { estatus: nuevoEstado });
  }
  return { sinStock };
  // Invalidar caché de clientes (aplica a todos los usuarios)
  Object.keys(localStorage)
    .filter(k => k.startsWith("mx_cache_clientes_"))
    .forEach(k => localStorage.removeItem(k));
}
export async function rechazarSolicitud(id) {
  const credRef = doc(db, "creditos", id);
  const snap = await getDoc(credRef);

  if (snap.exists()) {
    const credito = snap.data();
    // Si ya se había descontado el stock, lo devolvemos
    if (credito.stock_descontado === true) {
      const items = obtenerItemsDelCredito(credito);
      if (items.length > 0) {
        await devolverStock(items);
      }
    }
  }

  await deleteDoc(credRef);
}

/* Helper: extrae la lista de { id, cantidad } de un crédito.
   Funciona tanto si el crédito tiene "items" (lista completa)
   como si solo tiene el producto principal (créditos viejos). */
function obtenerItemsDelCredito(credito) {
  // Caso nuevo: el crédito guardó la lista completa
  if (Array.isArray(credito.items) && credito.items.length > 0) {
    return credito.items.map((it) => ({
      id: it.id,
      cantidad: Number(it.cantidad) || 1
    }));
  }
  // Caso viejo / respaldo: solo el producto principal
  if (credito.cv_producto) {
    return [{
      id: credito.cv_producto,
      cantidad: Number(credito.cantidad_producto) || 1
    }];
  }
  return [];
}

export async function editarDatosCliente(creditoId, datos) {
  const camposPermitidos = {
    nombre: datos.nombre,
    apePat: datos.apePat,
    apeMat: datos.apeMat,
    rfc: datos.rfc,
    curp: datos.curp,
    calle: datos.calle,
    colonia: datos.colonia,
    cp: datos.cp,
    direccion_completa: `${datos.calle}, ${datos.colonia}, C.P. ${datos.cp}`,
    telefono_cliente: datos.telefono_cliente || ""
  };
  if (datos.latitud && datos.longitud) {
    camposPermitidos.latitud = datos.latitud;
    camposPermitidos.longitud = datos.longitud;
  }
  await updateDoc(doc(db, "creditos", creditoId), camposPermitidos);
}

export async function getClientesActivos(uid, rol) {
  const clave = `clientes_${uid}`;
  const cached = await cacheGet(clave, 5 * 60 * 1000); // 5 min
  if (cached) return cached;
  let q;
  if (String(rol).toLowerCase() === "gerente") {
    q = query(collection(db, "creditos"), where("estatus", "==", 3));
  } else {
    q = query(collection(db, "creditos"),
      where("cv_usuario", "==", uid), where("estatus", "==", 3));
  }
  const datos = mapDocs(await getDocs(q));
  await cacheSet(clave, datos);
  return datos;
}

/* verificarCreditoActivoPorCURP(curp)
   Busca si ya existe un crédito ACTIVO (estatus 2 o 3) con la
   misma CURP, es decir, el mismo cliente con saldo pendiente.
   Devuelve null si no hay, o un objeto con los datos del
   crédito existente para poder avisar al vendedor:
   { nombre, total, saldo, producto } */
export async function verificarCreditoActivoPorCURP(curp) {
  if (!curp) return null;
  const curpLimpia = String(curp).trim().toUpperCase();
  if (curpLimpia.length < 10) return null;

  // Buscamos créditos con esa CURP
  const q = query(collection(db, "creditos"), where("curp", "==", curpLimpia));
  const creditos = mapDocs(await getDocs(q));

  // Nos quedamos con los que están activos (aprobado o entregado)
  // y todavía tienen saldo por pagar.
  const activos = creditos.filter((c) =>
    (c.estatus === 2 || c.estatus === 3) && (c.saldo || 0) > 0
  );

  if (activos.length === 0) return null;

  // Sumamos todo lo que debe (puede tener más de un crédito)
  let deudaTotal = 0;
  let saldoTotal = 0;
  activos.forEach((c) => {
    deudaTotal += c.total_venta || 0;
    saldoTotal += c.saldo || 0;
  });

  return {
    cantidadCreditos: activos.length,
    nombre: `${activos[0].nombre || ""} ${activos[0].apePat || ""}`.trim(),
    deudaTotal,        // cuánto fue el total de sus créditos
    saldoPendiente: saldoTotal,  // cuánto le falta por pagar
    yaPagado: deudaTotal - saldoTotal,
    productos: activos.map((c) => c.producto || "Producto").join(", ")
  };
}

export async function getClientesMapa(uid, rol) {
  const todos = await getClientesActivos(uid, rol);
  return todos.filter((c) => c.latitud && c.longitud);
}

/* ============================================================
   PAGOS
   ============================================================ */
export async function registrarPagoDinamico(cvCredito, montoPagado) {
  const credRef = doc(db, "creditos", cvCredito);
  const credSnap = await getDoc(credRef);
  if (!credSnap.exists()) throw new Error("Crédito no encontrado");

  // Guardar el pago con cortado:false y cv_usuario para el corte de caja
  await addDoc(collection(db, "pagos"), {
    cv_credito: cvCredito,
    monto_pagado: montoPagado,
    fecha: serverTimestamp(),
    cortado: false,                           // para corte de caja
    cv_usuario: credSnap.data().cv_usuario || "" // vendedor que hizo la venta
  });

  const cred = credSnap.data();
  const nuevoSaldo = Math.max(0, (cred.saldo || 0) - montoPagado);
  const nuevosPagosFaltantes = Math.max(0, (cred.pagos_faltantes || 0) - 1);

  await updateDoc(credRef, {
    saldo: nuevoSaldo,
    pagos_faltantes: nuevosPagosFaltantes
  });
  return { nuevoSaldo, nuevosPagosFaltantes };
  // Invalidar caché de clientes (aplica a todos los usuarios)
  Object.keys(localStorage)
    .filter(k => k.startsWith("mx_cache_clientes_"))
    .forEach(k => localStorage.removeItem(k));
}
export async function getPagosDeCredito(cvCredito) {
  const q = query(
    collection(db, "pagos"),
    where("cv_credito", "==", cvCredito)
  );
  const pagos = mapDocs(await getDocs(q));
  return pagos.sort((a, b) => {
    const fa = a.fecha?.seconds || 0;
    const fb = b.fecha?.seconds || 0;
    return fb - fa;
  });
}

/* corregirPago(pagoId, montoNuevo)
   Corrige el monto de un pago mal registrado y reajusta el
   saldo del crédito. SOLO el gerente (lo controlan las reglas
   de Firestore).
   - Calcula la diferencia entre el monto viejo y el nuevo.
   - Ajusta el saldo del crédito con esa diferencia. */
export async function corregirPago(pagoId, montoNuevo) {
  const pagoRef = doc(db, "pagos", pagoId);
  const pagoSnap = await getDoc(pagoRef);
  if (!pagoSnap.exists()) throw new Error("El pago no existe");

  const pago = pagoSnap.data();
  const montoViejo = Number(pago.monto_pagado) || 0;
  const cvCredito = pago.cv_credito;

  // Actualizar el monto del pago
  await updateDoc(pagoRef, {
    monto_pagado: montoNuevo,
    corregido: true,
    monto_anterior: montoViejo,
    fecha_correccion: serverTimestamp()
  });

  // Reajustar el saldo del crédito
  // Si antes pagó 500 y ahora son 5000, el saldo debe bajar 4500 más.
  const credRef = doc(db, "creditos", cvCredito);
  const credSnap = await getDoc(credRef);
  if (credSnap.exists()) {
    const cred = credSnap.data();
    const diferencia = montoNuevo - montoViejo; // positivo = pagó más
    const nuevoSaldo = Math.max(0, (cred.saldo || 0) - diferencia);
    await updateDoc(credRef, { saldo: nuevoSaldo });
  }
  // Invalidar caché de clientes (aplica a todos los usuarios)
  Object.keys(localStorage)
    .filter(k => k.startsWith("mx_cache_clientes_"))
    .forEach(k => localStorage.removeItem(k));
}
export async function cancelarPago(pagoId) {
  const pagoRef = doc(db, "pagos", pagoId);
  const pagoSnap = await getDoc(pagoRef);
  if (!pagoSnap.exists()) throw new Error("El pago no existe");

  const pago = pagoSnap.data();
  const monto = Number(pago.monto_pagado) || 0;
  const cvCredito = pago.cv_credito;

  // Devolver el monto al saldo del crédito
  const credRef = doc(db, "creditos", cvCredito);
  const credSnap = await getDoc(credRef);
  if (credSnap.exists()) {
    const cred = credSnap.data();
    await updateDoc(credRef, {
      saldo: (cred.saldo || 0) + monto,
      pagos_faltantes: (cred.pagos_faltantes || 0) + 1
    });
  }

  // Eliminar el pago
  await deleteDoc(pagoRef);
}


/* ============================================================
   USUARIOS / VENDEDORES
   ============================================================ */
export async function getVendedores() {
  const cached = await cacheGet("vendedores", 10 * 60 * 1000);
  if (cached) return cached;
  const q = query(collection(db, "usuarios"), where("rol", "==", "Vendedor"));
  const datos = mapDocs(await getDocs(q));
  await cacheSet("vendedores", datos);
  return datos;
}

export async function getPerfilCompleto(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const cartera = d.cartera || 0;
  const usado = d.usado || 0;
  return {
    uid,
    nombre_completo: d.nombre,
    login: d.login,
    rol: d.rol,
    telefono: d.telefono,
    cartera,
    usado,
    disponible: Math.max(0, cartera - usado)
  };
}

export async function crearVendedorCompleto({ nombre, login, password, telefono, cartera }) {
  const uid = await crearCuentaVendedor(login, password);
  await setDoc(doc(db, "usuarios", uid), {
    nombre,
    login,
    telefono: telefono || "",
    rol: "Vendedor",
    cartera: cartera || 50000,
    usado: 0,
    activo: true,
    password_visible: password,  // el gerente puede verla y cambiarla
    creado: serverTimestamp()
  });
  return uid;
}

export async function editarVendedor(uid, { nombre, login, telefono, cartera }) {
  await updateDoc(doc(db, "usuarios", uid), { nombre, login, telefono, cartera });
}

export async function cambiarEstadoVendedor(uid, activo) {
  await updateDoc(doc(db, "usuarios", uid), { activo });
}

export async function crearPerfilVendedor(uid, { nombre, login, telefono, cartera }) {
  await setDoc(doc(db, "usuarios", uid), {
    nombre, login, telefono,
    rol: "Vendedor",
    cartera: cartera || 50000,
    usado: 0,
    activo: true,
    creado: serverTimestamp()
  });
}

export async function cambiarPasswordVendedor(uid, nuevaPassword) {
  throw new Error("Cambiar contraseña requiere una Cloud Function (Admin SDK).");
}

/* ============================================================
   ESTADÍSTICAS PARA EL DASHBOARD
   ============================================================ */
export async function getEstadisticasGlobales() {
  const cached = await cacheGet("estadisticas", 15 * 60 * 1000); // 15 min
  if (cached) return cached;
  // Reutilizar caché de colecciones individuales si están disponibles
  const todosCreditos = await cacheGet("creditos_todos", 15 * 60 * 1000) ||
    (() => { const d = mapDocs; return null; })() ||
    mapDocs(await getDocs(collection(db, "creditos")));
  const todosPagos = mapDocs(await getDocs(collection(db, "pagos")));
  const todosProductos = await getProductos(); // usa caché 24h
  const todosVendedores = await getVendedores(); // usa caché 10min

  const solicitudesPendientes = todosCreditos.filter((c) => c.estatus === 1).length;
  const creditosAprobados = todosCreditos.filter((c) => c.estatus === 2).length;
  const clientesActivos = todosCreditos.filter((c) => c.estatus === 3).length;

  const totalPrestado = todosCreditos
    .filter((c) => c.estatus === 3)
    .reduce((acc, c) => acc + (c.total_venta || 0), 0);

  const totalCobrado = todosPagos.reduce((acc, p) => acc + (p.monto_pagado || 0), 0);

  const porCobrar = todosCreditos
    .filter((c) => c.estatus === 3)
    .reduce((acc, c) => acc + (c.saldo || 0), 0);

  const creditosLiquidados = todosCreditos
    .filter((c) => c.estatus === 3 && (c.saldo || 0) <= 0).length;

  const ventasPorVendedor = {};
  todosCreditos
    .filter((c) => c.estatus === 3)
    .forEach((c) => {
      const uid = c.cv_usuario;
      if (!ventasPorVendedor[uid]) {
        ventasPorVendedor[uid] = {
          uid, nombre: c.nombre_vendedor || "Sin nombre",
          totalVendido: 0, clientes: 0
        };
      }
      ventasPorVendedor[uid].totalVendido += c.total_venta || 0;
      ventasPorVendedor[uid].clientes += 1;
    });
  const topVendedores = Object.values(ventasPorVendedor)
    .sort((a, b) => b.totalVendido - a.totalVendido)
    .slice(0, 5);

  const productosVendidos = {};
  todosCreditos
    .filter((c) => c.estatus === 3 && c.cv_producto)
    .forEach((c) => {
      const id = c.cv_producto;
      if (!productosVendidos[id]) {
        productosVendidos[id] = {
          id, nombre: c.producto || "Sin nombre",
          ventas: 0, totalGenerado: 0
        };
      }
      productosVendidos[id].ventas += 1;
      productosVendidos[id].totalGenerado += c.total_venta || 0;
    });
  const topProductos = Object.values(productosVendidos)
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 5);

  const ahora = new Date();
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const cobradoEsteMes = todosPagos
    .filter((p) => {
      if (!p.fecha) return false;
      const fechaPago = new Date(p.fecha.seconds * 1000);
      return fechaPago >= primerDiaMes;
    })
    .reduce((acc, p) => acc + (p.monto_pagado || 0), 0);

  // Vencimientos REALES: usamos el cálculo de vencimientos.js
  let creditosVencidos = 0;
  let creditosPorVencer = 0;
  todosCreditos
    .filter((c) => c.estatus === 3 && (c.saldo || 0) > 0)
    .forEach((c) => {
      const v = calcularVencimiento(c);
      if (v.estado === "vencido") creditosVencidos++;
      else if (v.estado === "urgente" || v.estado === "porVencer") creditosPorVencer++;
    });

  // Productos con stock bajo (3 o menos)
  const stockBajo = todosProductos
    .filter((p) => (Number(p.stock) || 0) <= 3)
    .map((p) => ({ nombre: p.nombre, stock: Number(p.stock) || 0 }));

  return {
    solicitudesPendientes, creditosAprobados, clientesActivos,
    creditosLiquidados, creditosVencidos, creditosPorVencer,
    totalPrestado, totalCobrado, porCobrar, cobradoEsteMes,
    topVendedores, topProductos,
    totalVendedores: todosVendedores.length,
    totalProductosCatalogo: todosProductos.length,
    stockBajo
  };
}

/* ============================================================
   ESTADÍSTICAS POR VENDEDOR (para el dashboard del vendedor)
   ============================================================ */

/* getEstadisticasVendedor(uid)
   Devuelve el resumen de un vendedor específico:
   - Sus clientes activos con saldo, cuánto deben, etc.
   - Total por recuperar
   - Total ya cobrado
   - Cartera (total, usado, disponible) */
export async function getEstadisticasVendedor(uid) {
  const IVA = 0.16;

  // Créditos del vendedor
  const q = query(collection(db, "creditos"),
    where("cv_usuario", "==", uid));
  const creditos = mapDocs(await getDocs(q));

  // Pagos de sus créditos
  const todosPagos = mapDocs(await getDocs(collection(db, "pagos")));
  const misPagos = todosPagos.filter((p) =>
    creditos.some((c) => c.id === p.cv_credito)
  );

  // Perfil del vendedor
  const vendSnap = await getDoc(doc(db, "usuarios", uid));
  const vendedor = vendSnap.exists() ? vendSnap.data() : {};

  const cartera = vendedor.cartera || 0;
  const usado = vendedor.usado || 0;
  const disponible = Math.max(0, cartera - usado);

  // Clientes activos con detalle
  const clientesActivos = creditos
    .filter((c) => c.estatus === 3 && (c.saldo || 0) > 0)
    .map((c) => {
      const pagosCliente = misPagos
        .filter((p) => p.cv_credito === c.id)
        .reduce((acc, p) => acc + (p.monto_pagado || 0), 0);
      const costo = c.costo_producto || 0;
      const precioVenta = c.total_venta || 0;
      const ganancia = precioVenta - costo;
      return {
        id: c.id,
        nombre: `${c.nombre || ""} ${c.apePat || ""}`.trim(),
        producto: c.producto || "—",
        totalCredito: c.total_venta || 0,
        saldo: c.saldo || 0,
        cobrado: pagosCliente,
        ganancia: Math.max(0, ganancia)
      };
    })
    .sort((a, b) => b.saldo - a.saldo);

  const totalPorRecuperar = clientesActivos.reduce((a, c) => a + c.saldo, 0);
  const totalCobrado = misPagos.reduce((a, p) => a + (p.monto_pagado || 0), 0);
  const totalPrestado = creditos
    .filter((c) => c.estatus === 3)
    .reduce((a, c) => a + (c.total_venta || 0), 0);

  // IVA del total prestado
  const baseIVA = totalPrestado / (1 + IVA);
  const montoIVA = totalPrestado - baseIVA;

  // Efectivo pendiente de entregar al gerente
  const todosPagosVend = mapDocs(await getDocs(
    query(collection(db, "pagos"), where("cv_usuario", "==", uid))
  ));
  const efectivoPendiente = todosPagosVend
    .filter((p) => p.cortado !== true)
    .reduce((acc, p) => acc + (Number(p.monto_pagado) || 0), 0);

  return {
    cartera, usado, disponible,
    clientesActivos,
    totalPorRecuperar,
    totalCobrado,
    totalPrestado,
    efectivoPendiente,
    baseIVA: Math.round(baseIVA * 100) / 100,
    montoIVA: Math.round(montoIVA * 100) / 100,
    totalClientes: clientesActivos.length
  };
}

/* getEstadisticasGlobalesConIVA()
   Versión ampliada del dashboard del gerente que incluye:
   - Cartera de cada vendedor
   - Ganancias por vendedor
   - IVA desglosado */
export async function getEstadisticasGlobalesConIVA() {
  const IVA = 0.16;
  const MARGEN = 0.20;

  const todosCreditos = mapDocs(await getDocs(collection(db, "creditos")));
  const todosPagos = mapDocs(await getDocs(collection(db, "pagos")));
  const todosProductos = mapDocs(await getDocs(collection(db, "productos")));
  const todosVendedores = mapDocs(await getDocs(
    query(collection(db, "usuarios"), where("rol", "==", "Vendedor"))
  ));

  const solicitudesPendientes = todosCreditos.filter((c) => c.estatus === 1).length;
  const creditosAprobados = todosCreditos.filter((c) => c.estatus === 2).length;
  const clientesActivos = todosCreditos.filter((c) => c.estatus === 3).length;
  const creditosLiquidados = todosCreditos
    .filter((c) => c.estatus === 3 && (c.saldo || 0) <= 0).length;

  const totalPrestado = todosCreditos
    .filter((c) => c.estatus === 3)
    .reduce((acc, c) => acc + (c.total_venta || 0), 0);

  const totalCobrado = todosPagos.reduce((acc, p) => acc + (p.monto_pagado || 0), 0);
  const porCobrar = todosCreditos
    .filter((c) => c.estatus === 3)
    .reduce((acc, c) => acc + (c.saldo || 0), 0);

  // IVA del total prestado
  const baseIVA = totalPrestado / (1 + IVA);
  const montoIVA = totalPrestado - baseIVA;

  // Ganancias estimadas (20% del total prestado es la ganancia sobre costo)
  const gananciaTotal = totalPrestado * (MARGEN / (1 + MARGEN));

  // Cobrado este mes
  const ahora = new Date();
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const cobradoEsteMes = todosPagos
    .filter((p) => p.fecha && new Date(p.fecha.seconds * 1000) >= primerDiaMes)
    .reduce((acc, p) => acc + (p.monto_pagado || 0), 0);

  // Vencimientos reales
  let creditosVencidos = 0, creditosPorVencer = 0;
  todosCreditos
    .filter((c) => c.estatus === 3 && (c.saldo || 0) > 0)
    .forEach((c) => {
      const v = calcularVencimiento(c);
      if (v.estado === "vencido") creditosVencidos++;
      else if (v.estado === "urgente" || v.estado === "porVencer") creditosPorVencer++;
    });

  // Top vendedores con cartera y ganancias
  const ventasPorVendedor = {};
  todosCreditos
    .filter((c) => c.estatus === 3)
    .forEach((c) => {
      const uid = c.cv_usuario;
      if (!uid) return;
      if (!ventasPorVendedor[uid]) {
        const vend = todosVendedores.find((v) => v.id === uid);
        ventasPorVendedor[uid] = {
          uid,
          nombre: c.nombre_vendedor || "Sin nombre",
          cartera: vend?.cartera || 0,
          usado: vend?.usado || 0,
          disponible: Math.max(0, (vend?.cartera || 0) - (vend?.usado || 0)),
          totalVendido: 0,
          clientes: 0,
          ganancia: 0
        };
      }
      const monto = c.total_venta || 0;
      ventasPorVendedor[uid].totalVendido += monto;
      ventasPorVendedor[uid].clientes += 1;
      // Ganancia estimada: 20% del precio de venta es ganancia
      ventasPorVendedor[uid].ganancia += monto * (MARGEN / (1 + MARGEN));
    });

  const topVendedores = Object.values(ventasPorVendedor)
    .sort((a, b) => b.totalVendido - a.totalVendido);

  // Top productos
  const productosVendidos = {};
  todosCreditos.filter((c) => c.estatus === 3 && c.cv_producto)
    .forEach((c) => {
      const id = c.cv_producto;
      if (!productosVendidos[id]) {
        productosVendidos[id] = {
          id, nombre: c.producto || "Sin nombre",
          ventas: 0, totalGenerado: 0
        };
      }
      productosVendidos[id].ventas += 1;
      productosVendidos[id].totalGenerado += c.total_venta || 0;
    });
  const topProductos = Object.values(productosVendidos)
    .sort((a, b) => b.ventas - a.ventas).slice(0, 5);

  const stockBajo = todosProductos
    .filter((p) => (Number(p.stock) || 0) <= 3)
    .map((p) => ({ nombre: p.nombre, stock: Number(p.stock) || 0 }));

  return {
    solicitudesPendientes, creditosAprobados, clientesActivos,
    creditosLiquidados, creditosVencidos, creditosPorVencer,
    totalPrestado, totalCobrado, porCobrar, cobradoEsteMes,
    baseIVA: Math.round(baseIVA * 100) / 100,
    montoIVA: Math.round(montoIVA * 100) / 100,
    gananciaTotal: Math.round(gananciaTotal * 100) / 100,
    topVendedores, topProductos,
    totalVendedores: todosVendedores.length,
    totalProductosCatalogo: todosProductos.length,
    stockBajo
  };
}

/* ============================================================
   INTERESES MORATORIOS
   ============================================================ */

// 10% mensual sobre el pago vencido
// Si el pago era de $1,000 y no pagó, el cargo es $100 (10%)
const TASA_MORATORIA_MENSUAL = 0.10; // 10% mensual
const TASA_MORATORIA_DIARIA = TASA_MORATORIA_MENSUAL / 30; // ~0.333% diario

/* calcularDiasVencido(credito)
   Devuelve cuántos días lleva vencido un crédito.
   Un crédito está vencido si pasó la fecha del próximo pago
   y no se ha pagado ese período. */
function calcularDiasVencido(credito) {
  if (!credito.fecha_entrega || credito.estatus !== 3 || (credito.saldo || 0) <= 0) {
    return 0;
  }
  const fechaBase = new Date(credito.fecha_entrega.seconds * 1000);
  const ahora = new Date();
  const diasTotales = Math.floor((ahora - fechaBase) / (1000 * 60 * 60 * 24));
  const diasPorPeriodo = String(credito.frecuencia).toLowerCase().includes("quincenal") ? 15 : 30;
  const pagosFaltantes = credito.pagos_faltantes || 0;
  const pagosHechos = (credito.total_pagos || 1) - pagosFaltantes;
  const diasEsperados = pagosHechos * diasPorPeriodo;
  const diasVencidos = Math.max(0, diasTotales - diasEsperados);
  return diasVencidos;
}

/* aplicarInteresesMoratorios()
   Revisa TODOS los créditos activos con saldo pendiente.
   Si alguno tiene días vencidos, calcula el recargo y lo suma al saldo.
   Guarda también el campo "recargo" y "estatus_mora" en Firestore.
   Se llama automáticamente al abrir la app.
   Devuelve la cantidad de créditos actualizados. */
const DIAS_MORA_MAXIMA = 60; // días máximos sin pagar antes de mora máxima

export async function aplicarInteresesMoratorios() {
  // Solo una vez al dia por dispositivo
  const hoy = new Date().toDateString();
  const yaCalculo = await cacheGet("mora_calculada", 24 * 60 * 60 * 1000);
  if (yaCalculo === hoy) return 0;

  // Reusar clientes de cache si estan frescos (< 10 min)
  let creditos = null;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("mx_cache_clientes_")) {
      try {
        const { ts, datos } = JSON.parse(localStorage.getItem(k));
        if (Date.now() - ts < 10 * 60 * 1000) {
          creditos = datos.filter((c) => (c.saldo || 0) > 0);
          break;
        }
      } catch (_) {}
    }
  }
  if (!creditos) {
    const snap = await getDocs(query(
      collection(db, "creditos"),
      where("estatus", "==", 3)
    ));
    creditos = mapDocs(snap).filter((c) => (c.saldo || 0) > 0);
  }

  let actualizados = 0;
  const ahora = serverTimestamp();

  for (const credito of creditos) {
    const diasVencidos = calcularDiasVencido(credito);
    if (diasVencidos <= 0) {
      // Si ya estaba en mora pero ahora está al corriente, limpiar
      if (credito.estatus_mora === "Moroso" || credito.estatus_mora === "Mora máxima") {
        await updateDoc(doc(db, "creditos", credito.id), {
          estatus_mora: "Al corriente",
          recargo: 0,
          dias_vencidos: 0
        });
        actualizados++;
      }
      continue;
    }

    // Detectar mora máxima (más de 60 días sin pagar)
    const esMoraMaxima = diasVencidos >= DIAS_MORA_MAXIMA;
    const estatusMora = esMoraMaxima ? "Mora máxima" : "Moroso";

    // Calcular recargo: 10% mensual sobre el monto del pago vencido
    const saldoBase = credito.saldo_sin_recargo || credito.saldo || 0;
    const totalPagos = credito.total_pagos || 1;
    const montoPagoEsperado = (credito.total_venta || saldoBase) / totalPagos;
    const mesesVencidos = Math.ceil(diasVencidos / 30);
    const recargo = Math.round(montoPagoEsperado * TASA_MORATORIA_MENSUAL * mesesVencidos * 100) / 100;
    const nuevoSaldo = Math.round((saldoBase + recargo) * 100) / 100;

    // Solo actualizar si algo cambió
    const cambioMora = credito.estatus_mora !== estatusMora;
    const cambioRecargo = Math.abs((credito.recargo || 0) - recargo) > 0.01;

    if (cambioMora || cambioRecargo) {
      await updateDoc(doc(db, "creditos", credito.id), {
        saldo: nuevoSaldo,
        saldo_sin_recargo: saldoBase,
        recargo,
        dias_vencidos: diasVencidos,
        estatus_mora: estatusMora,
        mora_maxima: esMoraMaxima,  // flag para avisos y dashboard
        ultima_actualizacion_mora: ahora
      });
      actualizados++;
    }
  }

  await cacheSet("mora_calculada", hoy);
  if (actualizados > 0) {
    Object.keys(localStorage)
      .filter(k => k.startsWith("mx_cache_clientes_"))
      .forEach(k => localStorage.removeItem(k));
  }
  return actualizados;
}

/* ============================================================
   VENTAS AL CONTADO
   ============================================================ */

/* registrarVentaContado({ items, totalVenta, montoPagado, vendedor })
   Registra una venta al contado:
   - Descuenta el stock de cada producto.
   - Guarda el registro de la venta.
   - Devuelve el cambio. */
export async function registrarVentaContado({ items, totalVenta, montoPagado, cvUsuario, nombreVendedor }) {
  if (montoPagado < totalVenta) {
    throw new Error("El monto pagado es insuficiente para cubrir el total.");
  }

  // Descontar stock
  const sinStock = await descontarStock(items.map((it) => ({
    id: it.id, cantidad: it.cantidad
  })));

  // Guardar registro de venta al contado
  const ref = await addDoc(collection(db, "ventas_contado"), {
    items: items.map((it) => ({
      id: it.id, nombre: it.nombre,
      cantidad: it.cantidad, precio: it.precio
    })),
    total_venta: totalVenta,
    monto_pagado: montoPagado,
    cambio: Math.round((montoPagado - totalVenta) * 100) / 100,
    cv_usuario: cvUsuario,
    nombre_vendedor: nombreVendedor || "",
    fecha: serverTimestamp()
  });

  return {
    id: ref.id,
    cambio: Math.round((montoPagado - totalVenta) * 100) / 100,
    sinStock
  };
}

/* ============================================================
   CAMBIO DE CONTRASEÑA Y LOGIN (solo gerente)
   ============================================================ */

/* guardarPasswordVendedor(uid, passwordNueva)
   Guarda la nueva contraseña en Firestore para que el gerente
   pueda verla. También la actualiza en Firebase Auth usando
   el truco del app secundaria.
   IMPORTANTE: el gerente necesita saber la contraseña actual. */
export async function actualizarLoginVendedor(uid, nuevoLogin) {
  await updateDoc(doc(db, "usuarios", uid), { login: nuevoLogin });
}

/* ============================================================
   PERMISOS DE VENDEDORES
   ============================================================
   Estructura en Firestore usuarios/{uid}.permisos:
   {
     inventario: true,     // puede crear/editar productos
     editarPrecios: true,  // puede cambiar precios
     venderCredito: true,  // puede vender a crédito
     venderContado: true,  // puede vender al contado
   }
   ============================================================ */

export async function getPermisos(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return {};
  return snap.data().permisos || {
    inventario: false,
    editarPrecios: false,
    venderCredito: true,
    venderContado: true
  };
}

export async function actualizarPermisos(uid, permisos) {
  await updateDoc(doc(db, "usuarios", uid), { permisos });
}

/* ============================================================
   EFECTIVO / CORTE DE CAJA
   ============================================================
   Cuando un vendedor registra un pago, ese monto va a su
   "efectivo pendiente de entregar". El gerente lo confirma
   y genera un recibo de corte.
   Colección: cortes_caja/{id}
   ============================================================ */

export async function getCortesVendedor(uidVendedor) {
  const q = query(
    collection(db, "cortes_caja"),
    where("uid_vendedor", "==", uidVendedor),
    orderBy("fecha", "desc")
  );
  return mapDocs(await getDocs(q));
}

export async function getEfectivoPendiente(uidVendedor) {
  // Traer TODOS los pagos del vendedor y filtrar en memoria
  // (los pagos viejos no tienen campo "cortado", se tratan como no cortados)
  const q = query(
    collection(db, "pagos"),
    where("cv_usuario", "==", uidVendedor)
  );
  const snaps = mapDocs(await getDocs(q));
  const pendientes = snaps.filter((p) => p.cortado !== true); // null/undefined = pendiente
  return pendientes.reduce((acc, p) => acc + (Number(p.monto_pagado) || 0), 0);
}

export async function confirmarCorteCaja({ uidVendedor, nombreVendedor, monto, nota }) {
  // 1. Marcar todos los pagos pendientes como cortados
  // Traer todos los pagos del vendedor, marcar como cortados los pendientes
  const q = query(
    collection(db, "pagos"),
    where("cv_usuario", "==", uidVendedor)
  );
  const pagos = mapDocs(await getDocs(q));
  const pendientes = pagos.filter((p) => p.cortado !== true);
  for (const p of pendientes) {
    await updateDoc(doc(db, "pagos", p.id), { cortado: true });
  }

  // 2. Crear registro del corte
  const ref = await addDoc(collection(db, "cortes_caja"), {
    uid_vendedor: uidVendedor,
    nombre_vendedor: nombreVendedor,
    monto,
    nota: nota || "",
    fecha: serverTimestamp()
  });

  // Invalidar caché de clientes para que se refleje
  Object.keys(localStorage)
    .filter(k => k.startsWith("mx_cache_clientes_"))
    .forEach(k => localStorage.removeItem(k));

  return ref.id;
}

/* ============================================================
   COMISIONES DEL VENDEDOR (10%)
   El gerente registra manualmente el pago de comisión.
   Colección: comisiones/{id}
   ============================================================ */

export async function registrarComision({ uidVendedor, nombreVendedor, monto, nota }) {
  const ref = await addDoc(collection(db, "comisiones"), {
    uid_vendedor: uidVendedor,
    nombre_vendedor: nombreVendedor,
    monto,
    nota: nota || "",
    fecha: serverTimestamp()
  });
  return ref.id;
}

export async function getComisionesVendedor(uidVendedor) {
  const q = query(
    collection(db, "comisiones"),
    where("uid_vendedor", "==", uidVendedor),
    orderBy("fecha", "desc")
  );
  return mapDocs(await getDocs(q));
}

/* ============================================================
   OFERTAS DEL DÍA
   ============================================================
   Un producto puede tener descuento. Se guarda directamente
   en el documento del producto:
   { descuento: 20, en_oferta: true }
   También se puede aplicar por categoría.
   Colección aparte: ofertas_categoria/{id}
   ============================================================ */

export async function activarOfertaProducto(idProducto, porcentaje) {
  await updateDoc(doc(db, "productos", idProducto), {
    en_oferta: true,
    descuento: porcentaje
  });
  await cacheInvalidar("productos");
}

export async function desactivarOfertaProducto(idProducto) {
  await updateDoc(doc(db, "productos", idProducto), {
    en_oferta: false,
    descuento: 0
  });
  await cacheInvalidar("productos");
}

export async function activarOfertaCategoria(categoria, porcentaje) {
  // Actualiza todos los productos de esa categoría
  const prods = await getProductos();
  const deLaCategoria = prods.filter(p =>
    (p.categoria || "").toLowerCase() === categoria.toLowerCase()
  );
  for (const p of deLaCategoria) {
    await updateDoc(doc(db, "productos", p.id), {
      en_oferta: true,
      descuento: porcentaje
    });
  }
  await cacheInvalidar("productos");
}

export async function desactivarOfertaCategoria(categoria) {
  const prods = await getProductos();
  const deLaCategoria = prods.filter(p =>
    (p.categoria || "").toLowerCase() === categoria.toLowerCase()
  );
  for (const p of deLaCategoria) {
    await updateDoc(doc(db, "productos", p.id), {
      en_oferta: false,
      descuento: 0
    });
  }
  await cacheInvalidar("productos");
}

/* precio con descuento aplicado */
export function precioConDescuento(precio, descuento) {
  if (!descuento || descuento <= 0) return precio;
  return Math.round(precio * (1 - descuento / 100) * 100) / 100;
}

/* desglose IVA — el precio YA incluye IVA */
export function desgloseIVA(precioConIva) {
  const base = Math.round((precioConIva / 1.16) * 100) / 100;
  const iva  = Math.round((precioConIva - base) * 100) / 100;
  return { base, iva, total: precioConIva };
}


// Alias de compatibilidad
export const getPagosCredito = getPagosDeCredito;

/* ============================================================
   ESTADÍSTICAS DE CARTERA POR VENDEDOR (para dashboard gerente)
   ============================================================ */

export async function getCarteraPorVendedor() {
  const cached = await cacheGet("cartera_vendedores", 15 * 60 * 1000);
  if (cached) return cached;

  const [vendedores, creditos, pagos] = await Promise.all([
    getVendedores(),
    getDocs(collection(db, "creditos")),
    getDocs(collection(db, "pagos"))
  ]);

  const todosCreditos = mapDocs(creditos);
  const todosPagos    = mapDocs(pagos);

  const resultado = vendedores.map((v) => {
    const creditosVend = todosCreditos.filter(c => c.cv_usuario === v.id);
    const pagosVend    = todosPagos.filter(p => p.cv_usuario === v.id);

    // Efectivo en posesión (no cortado)
    const efectivo = pagosVend
      .filter(p => p.cortado !== true)
      .reduce((a, p) => a + (Number(p.monto_pagado) || 0), 0);

    // Clientes activos (estatus 3 con saldo > 0)
    const clientesActivos = creditosVend.filter(c => c.estatus === 3 && (c.saldo || 0) > 0);

    // Total por recuperar
    const porRecuperar = clientesActivos.reduce((a, c) => a + (c.saldo || 0), 0);

    // Total cobrado histórico
    const cobradoTotal = pagosVend.reduce((a, p) => a + (Number(p.monto_pagado) || 0), 0);

    // Clientes en mora máxima
    const moraMaxima = clientesActivos.filter(c => c.mora_maxima === true).length;

    // Pagos por mes (últimos 6 meses)
    const pagosMes = {};
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      pagosMes[key] = 0;
    }
    pagosVend.forEach(p => {
      if (!p.fecha?.seconds) return;
      const d = new Date(p.fecha.seconds * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (key in pagosMes) pagosMes[key] += Number(p.monto_pagado) || 0;
    });

    return {
      id: v.id,
      nombre: v.nombre,
      cartera: v.cartera || 0,
      usado: v.usado || 0,
      efectivo,
      clientesActivos: clientesActivos.length,
      porRecuperar,
      cobradoTotal,
      moraMaxima,
      pagosMes
    };
  });

  await cacheSet("cartera_vendedores", resultado);
  return resultado;
}

/* Pagos mensuales generales (últimos 6 meses) para gráfica total */
export async function getPagosMensualesGlobal() {
  const cached = await cacheGet("pagos_mensuales", 15 * 60 * 1000);
  if (cached) return cached;

  const snap = await getDocs(collection(db, "pagos"));
  const pagos = mapDocs(snap);

  const hoy = new Date();
  const meses = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
    meses[key] = { label, total: 0 };
  }

  pagos.forEach(p => {
    if (!p.fecha?.seconds) return;
    const d = new Date(p.fecha.seconds * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (key in meses) meses[key].total += Number(p.monto_pagado) || 0;
  });

  const resultado = Object.values(meses);
  await cacheSet("pagos_mensuales", resultado);
  return resultado;
}

/* ============================================================
   COLONIAS ASIGNADAS POR VENDEDOR
   Se guardan en usuarios/{uid}.colonias = ["centro","norte",...]
   ============================================================ */

export async function getColoniasVendedor(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return [];
  return snap.data().colonias || [];
}

export async function actualizarColoniasVendedor(uid, colonias) {
  await updateDoc(doc(db, "usuarios", uid), { colonias });
  // Invalidar caché de vendedores
  Object.keys(localStorage)
    .filter(k => k.startsWith("mx_cache_vendedores") ||
                 k.startsWith("mx_cache_cartera"))
    .forEach(k => localStorage.removeItem(k));
}
