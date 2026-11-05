/* ============================================================
   storage.js · Manejo de imágenes (versión Base64)
   ------------------------------------------------------------
   IMPORTANTE: esta versión NO usa Firebase Storage.
   Las fotos se comprimen y se devuelven como texto Base64
   para guardarse directamente en Firestore.

   ¿Por qué? Firebase Storage requiere el plan Blaze (de pago).
   Base64 en Firestore funciona en el plan gratuito.

   La función se sigue llamando "subirImagen" para no tener
   que cambiar el resto del código, pero en realidad ya no
   "sube" nada: solo comprime y devuelve el Base64.
   ============================================================ */

import { comprimirAFotoBase64 } from "./compresor.js";

/* ------------------------------------------------------------
   subirImagen(file, carpeta, perfil, onProgreso)
   - file:       File de un <input type="file">
   - carpeta:    se ignora (se mantiene por compatibilidad)
   - perfil:     "cliente" | "producto"
   - onProgreso: función opcional con texto de estado
   Devuelve un string Base64 (data:image/...;base64,...).
------------------------------------------------------------ */
export async function subirImagen(file, carpeta = "varios", perfil = "cliente", onProgreso = null) {
  const aviso = (txt) => { if (onProgreso) onProgreso(txt); };

  const resultado = await comprimirAFotoBase64(file, perfil, aviso);

  aviso("Listo");
  // Devolvemos el Base64. Donde antes se guardaba una URL,
  // ahora se guarda este texto. En el HTML, <img src="..."> 
  // funciona igual con Base64.
  return resultado.base64;
}

/* ------------------------------------------------------------
   subirVariasConProgreso(files, carpeta, perfil, onProgreso)
   Procesa varias fotos en secuencia, mostrando progreso.
   - onProgreso recibe: { indice, total, texto, porcentaje }
   Devuelve un arreglo de strings Base64.
------------------------------------------------------------ */
export async function subirVariasConProgreso(files, carpeta = "varios", perfil = "cliente", onProgreso = null) {
  const resultados = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const numActual = i + 1;

    const avisoFoto = (texto) => {
      if (onProgreso) {
        onProgreso({
          indice: numActual,
          total,
          texto: `Foto ${numActual} de ${total}: ${texto}`,
          porcentaje: Math.round(((i + 0.5) / total) * 100)
        });
      }
    };

    const base64 = await subirImagen(files[i], carpeta, perfil, avisoFoto);
    resultados.push(base64);

    if (onProgreso) {
      onProgreso({
        indice: numActual,
        total,
        texto: `Foto ${numActual} de ${total} lista`,
        porcentaje: Math.round((numActual / total) * 100)
      });
    }
  }

  return resultados;
}

/* ------------------------------------------------------------
   subirVarias(files, carpeta, perfil)
   Versión simple sin progreso.
------------------------------------------------------------ */
export async function subirVarias(files, carpeta = "varios", perfil = "cliente") {
  return subirVariasConProgreso(files, carpeta, perfil, null);
}
