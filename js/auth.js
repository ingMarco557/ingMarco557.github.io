/* ============================================================
   auth.js · Manejo de sesión con Firebase Authentication
   ------------------------------------------------------------
   En tu app Android el login iba contra Python/PostgreSQL y
   devolvía { cv_usuario, rol, nombre }. Aquí lo reemplazamos por:

   - Firebase Auth  → valida usuario y contraseña.
   - Firestore      → guarda el PERFIL (rol, nombre, cartera, etc.)
                      en la colección "usuarios", documento = uid.

   El "rol" (Gerente / Vendedor) ya no viene en el login: lo leemos
   del documento del usuario en Firestore.
   ============================================================ */

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* Cache del perfil del usuario en memoria (equivale a SharedPreferences) */
let perfilActual = null;

/* ------------------------------------------------------------
   INICIAR SESIÓN
   Tu login Android usaba "usuario" (texto). Firebase Auth usa email.
   Opciones:
   a) Pedir email directamente (recomendado).
   b) Si quieres conservar logins tipo "vendedor01", crea los usuarios
      con un email ficticio: vendedor01@mueblimex.app y en pantalla
      solo pides el "usuario", concatenando "@mueblimex.app" por código.
   Abajo se implementa la opción (b) para parecerse a tu app original.
------------------------------------------------------------ */
const DOMINIO_FICTICIO = "@mueblimex.app";

export async function login(usuario, password) {
  // Si el usuario ya escribió un email completo, lo respetamos.
  const email = usuario.includes("@") ? usuario : usuario + DOMINIO_FICTICIO;
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Cargamos el perfil desde Firestore
  const snap = await getDoc(doc(db, "usuarios", cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Tu usuario no tiene perfil registrado. Contacta al gerente.");
  }
  perfilActual = { uid: cred.user.uid, ...snap.data() };

  // Verificar que el vendedor no esté dado de baja
  if (perfilActual.activo === false) {
    await signOut(auth);
    throw new Error("Tu cuenta está desactivada.");
  }
  return perfilActual;
}

/* ------------------------------------------------------------
   CERRAR SESIÓN
------------------------------------------------------------ */
export async function logout() {
  await signOut(auth);
  perfilActual = null;
}

/* ------------------------------------------------------------
   OBTENER PERFIL EN CACHE
   Si aún no está cargado (ej. al recargar la página) lo trae de Firestore.
------------------------------------------------------------ */
export async function getPerfil() {
  if (perfilActual) return perfilActual;
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (snap.exists()) {
    perfilActual = { uid: user.uid, ...snap.data() };
  }
  return perfilActual;
}

/* Atajos de conveniencia */
export function getUid() {
  return auth.currentUser ? auth.currentUser.uid : null;
}
export function esGerente() {
  return perfilActual && String(perfilActual.rol).toLowerCase() === "gerente";
}

/* Devuelve los permisos del vendedor actual (ya cargados en perfil) */
export function getPermisosActuales() {
  if (!perfilActual) return {};
  if (esGerente()) {
    // El gerente tiene todos los permisos siempre
    return { inventario: true, editarPrecios: true, venderCredito: true, venderContado: true };
  }
  return perfilActual.permisos || {
    inventario: false,
    editarPrecios: false,
    venderCredito: true,
    venderContado: true
  };
}

export function tienePermiso(permiso) {
  return !!getPermisosActuales()[permiso];
}

/* ------------------------------------------------------------
   OBSERVADOR DE ESTADO DE SESIÓN
   Llama al callback cuando cambia el estado (login / logout).
   Lo usa app.js para decidir si mostrar Login o el Menú principal.
------------------------------------------------------------ */
export function observarSesion(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await getPerfil(); // asegura que el perfil esté cargado
      callback(perfilActual);
    } else {
      perfilActual = null;
      callback(null);
    }
  });
}
