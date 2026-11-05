/* ============================================================
   firebase-messaging-sw.js · Service Worker de notificaciones
   ============================================================ */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
);

// Configuración idéntica a la de tu aplicación principal
firebase.initializeApp({
  apiKey: "AIzaSyDbCHsroQeeiNfuOTqV5IZh_HiUCairRX0",
  authDomain: "mueblimex-d7b56.firebaseapp.com",
  projectId: "mueblimex-d7b56",
  storageBucket: "mueblimex-d7b56.firebasestorage.app",
  messagingSenderId: "315386452520",
  appId: "1:315386452520:web:9c1d60250486235541f31d",
});

const messaging = firebase.messaging();

/* Manejo de notificaciones en segundo plano */
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Recibido mensaje en segundo plano:",
    payload,
  );

  const titulo = payload.notification?.title || "Mueblimex";
  const opciones = {
    body:
      payload.notification?.body ||
      "Tienes una nueva actualización en tu cuenta.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: payload.data, // Útil para redirigir al usuario al hacer clic
  };

  self.registration.showNotification(titulo, opciones);
});
