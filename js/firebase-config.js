/* ============================================================
   firebase-config.js · Configuración Modular (v10)
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  getMessaging,
  isSupported,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbCHsroQeeiNfuOTqV5IZh_HiUCairRX0",
  authDomain: "mueblimex-d7b56.firebaseapp.com",
  projectId: "mueblimex-d7b56",
  storageBucket: "mueblimex-d7b56.firebasestorage.app",
  messagingSenderId: "315386452520",
  appId: "1:315386452520:web:9c1d60250486235541f31d",
  measurementId: "G-ZRXBLKBJ13",
};

export { firebaseConfig };

export const GOOGLE_MAPS_API_KEY = "AIzaSyAvCu6HRO4qBMPmE_wzMCgvX5Zq_Z8oYjE";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.warn("Error fijando persistencia:", e),
);

export let messaging = null;
isSupported().then((ok) => {
  if (ok) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn("Messaging no disponible:", e);
    }
  }
});

export default app;
