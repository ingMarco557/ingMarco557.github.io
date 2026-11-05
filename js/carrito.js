/* ============================================================
   carrito.js · Manejo del carrito de compras
   ------------------------------------------------------------
   Equivalente exacto a tu CarritoManager.kt (patrón Singleton).
   Como en JS un módulo ya es un singleton, simplemente exportamos
   funciones que operan sobre una lista privada del módulo.

   El carrito vive en memoria. Si quieres que sobreviva a recargas
   de página, descomenta las líneas de localStorage marcadas.
   ============================================================ */

let lista = [];

/* Si quieres persistencia entre recargas, descomenta esto:
try { lista = JSON.parse(localStorage.getItem("carrito") || "[]"); } catch {}
function guardar() { localStorage.setItem("carrito", JSON.stringify(lista)); }
*/
function guardar() { /* no-op si no usas localStorage */ }

/* agregarAlCarrito(mueble, cantidad)
   Si el producto ya existe (por id), suma la cantidad. */
export function agregarAlCarrito(mueble, cantidad) {
  const existente = lista.find((it) => it.id === mueble.id);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    lista.push({ ...mueble, cantidad });
  }
  guardar();
}

/* obtenerCarrito() — devuelve la lista actual */
export function obtenerCarrito() {
  return lista;
}

/* eliminarProducto(id) */
export function eliminarProducto(id) {
  lista = lista.filter((it) => it.id !== id);
  guardar();
}

/* cambiarCantidad(id, delta) — suma o resta 1; si llega a 0, elimina */
export function cambiarCantidad(id, delta) {
  const item = lista.find((it) => it.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) eliminarProducto(id);
  guardar();
}

/* calcularTotal() — suma precio * cantidad de cada item */
export function calcularTotal() {
  return lista.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
}

/* contarProductos() — total de unidades (para el badge del carrito) */
export function contarProductos() {
  return lista.reduce((acc, it) => acc + it.cantidad, 0);
}

/* limpiarCarrito() — vacía todo (tras una venta exitosa) */
export function limpiarCarrito() {
  lista = [];
  guardar();
}
