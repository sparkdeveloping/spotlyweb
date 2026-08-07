import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getToken as getAppCheckToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDVq07eOLK7fLt5200h4m7dFhFM_csQF3o",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "denzeltinashe-spotly.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "denzeltinashe-spotly",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "denzeltinashe-spotly.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "815870787939",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:815870787939:web:6154be469fb3f076f5d356",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-M5DE8TVHFL"
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let client;
let analyticsPromise;
let messagingPromise;

function buildClient() {
  if (!isFirebaseConfigured || typeof window === "undefined") return null;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch {
    // initializeFirestore throws when another module initialized Firestore first.
    db = getFirestore(app);
  }

  const storage = getStorage(app);

  const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (appCheckSiteKey && !globalThis.__spotlyAppCheck) {
    try {
      globalThis.__spotlyAppCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch {
      // App Check is optional until the key is configured in Firebase Console.
    }
  }

  return { app, auth, db, storage, config: firebaseConfig };
}

export function getFirebaseClient() {
  if (!client) client = buildClient();
  return client;
}


export async function getFirebaseAppCheckToken() {
  getFirebaseClient();
  const appCheck = globalThis.__spotlyAppCheck;
  if (!appCheck) return "";
  try {
    return (await getAppCheckToken(appCheck, false)).token || "";
  } catch {
    return "";
  }
}

export async function getFirebaseAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const sdk = getFirebaseClient();
      if (!sdk || !(await analyticsSupported())) return null;
      return getAnalytics(sdk.app);
    })();
  }
  return analyticsPromise;
}

export async function getFirebaseMessaging() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const sdk = getFirebaseClient();
      if (!sdk || !(await messagingSupported())) return null;
      return getMessaging(sdk.app);
    })();
  }
  return messagingPromise;
}

export { firebaseConfig };
