/* ============================================================
   js/auth-admin.js · Operaciones admin sin cerrar sesión
   ============================================================ */

import { db } from "./firebase-config.js";
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, updatePassword,
         signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const DOMINIO_FICTICIO = "@mueblimex.app";

function sanitizar(u) {
  return u.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/* crearCuentaVendedor(usuario, password)
   Crea una cuenta nueva en Firebase Auth con email ficticio.
   Devuelve el UID del nuevo usuario. */
export async function crearCuentaVendedor(usuario, password) {
  const usuarioLimpio = usuario.includes("@") ? usuario : sanitizar(usuario);
  if (!usuarioLimpio) throw new Error("El nombre de usuario no es válido");
  const email = usuario.includes("@") ? usuario : usuarioLimpio + DOMINIO_FICTICIO;

  const appTemp = initializeApp(firebaseConfig, "crear-vendedor-" + Date.now());
  const authTemp = getAuth(appTemp);
  try {
    const cred = await createUserWithEmailAndPassword(authTemp, email, password);
    const uid = cred.user.uid;
    await signOut(authTemp);
    return uid;
  } finally {
    await deleteApp(appTemp).catch(() => {});
  }
}

/* cambiarPasswordVendedor(uid, passwordNueva)
   Cambia la contraseña de un vendedor.
   Requiere conocer el login y la contraseña actual guardados en Firestore.
   Solo el gerente puede hacer esto. */
export async function cambiarPasswordVendedor(uid, passwordNueva) {
  // Obtener el login actual del vendedor desde Firestore
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) throw new Error("Vendedor no encontrado");
  const datos = snap.data();
  const loginActual = datos.login || "";
  const passwordActual = datos.password_visible || "";

  if (!passwordActual) {
    throw new Error("No se encontró la contraseña actual del vendedor en el sistema. Elimina y recrea la cuenta.");
  }

  const emailLimpio = sanitizar(loginActual) + DOMINIO_FICTICIO;

  const appTemp = initializeApp(firebaseConfig, "cambiar-pass-" + Date.now());
  const authTemp = getAuth(appTemp);
  try {
    // Iniciar sesión con las credenciales actuales del vendedor
    const cred = await signInWithEmailAndPassword(authTemp, emailLimpio, passwordActual);
    // Cambiar la contraseña
    await updatePassword(cred.user, passwordNueva);
    await signOut(authTemp);

    // Guardar la nueva contraseña en Firestore (para que el gerente pueda verla)
    await updateDoc(doc(db, "usuarios", uid), {
      password_visible: passwordNueva
    });
  } finally {
    await deleteApp(appTemp).catch(() => {});
  }
}

/* cambiarLoginVendedor(uid, nuevoLogin, passwordActual)
   Cambia el email ficticio del vendedor en Firebase Auth.
   Solo el gerente puede hacer esto. */
export async function cambiarLoginVendedor(uid, nuevoLogin, passwordActual) {
  const loginLimpio = sanitizar(nuevoLogin);
  if (!loginLimpio) throw new Error("El nuevo usuario no es válido");
  const emailNuevo = loginLimpio + DOMINIO_FICTICIO;

  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) throw new Error("Vendedor no encontrado");
  const datos = snap.data();
  const loginActual = datos.login || "";
  const password = datos.password_visible || passwordActual || "";

  if (!password) throw new Error("Se necesita la contraseña para cambiar el usuario");

  const emailActual = sanitizar(loginActual) + DOMINIO_FICTICIO;

  const appTemp = initializeApp(firebaseConfig, "cambiar-login-" + Date.now());
  const authTemp = getAuth(appTemp);
  try {
    // Iniciar sesión con credenciales actuales
    const cred = await signInWithEmailAndPassword(authTemp, emailActual, password);
    // Cambiar el email
    const { updateEmail } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    await updateEmail(cred.user, emailNuevo);
    await signOut(authTemp);

    // Actualizar el login en Firestore
    await updateDoc(doc(db, "usuarios", uid), { login: nuevoLogin });
  } finally {
    await deleteApp(appTemp).catch(() => {});
  }
}
