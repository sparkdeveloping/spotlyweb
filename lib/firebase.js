import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getToken as getAppCheckToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";
import { getPerformance } from "firebase/performance";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { SPOTLY_FIREBASE_DATABASE_URL, SPOTLY_FIREBASE_FUNCTIONS_REGION, SPOTLY_FIREBASE_PROJECT_ID, SPOTLY_FIREBASE_WEB_CONFIG } from "./firebase-project-config";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || SPOTLY_FIREBASE_WEB_CONFIG.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || SPOTLY_FIREBASE_WEB_CONFIG.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || SPOTLY_FIREBASE_WEB_CONFIG.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || SPOTLY_FIREBASE_WEB_CONFIG.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || SPOTLY_FIREBASE_WEB_CONFIG.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || SPOTLY_FIREBASE_WEB_CONFIG.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || SPOTLY_FIREBASE_WEB_CONFIG.measurementId
};

if (firebaseConfig.projectId !== SPOTLY_FIREBASE_PROJECT_ID) {
  throw new Error(
    `Spotly Firebase project mismatch: expected ${SPOTLY_FIREBASE_PROJECT_ID}, received ${firebaseConfig.projectId}. ` +
    "Update NEXT_PUBLIC_FIREBASE_* deployment variables before starting the app."
  );
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let client;
let analyticsPromise;
let messagingPromise;
let performanceInstance;

function buildClient() {
  if (!isFirebaseConfigured || typeof window === "undefined") return null;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // App Check must initialize before any Firebase product SDK is accessed.
  // Initializing Auth/Firestore/Functions first can leave requests unattested even
  // when the production reCAPTCHA Enterprise key is configured correctly.
  const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (appCheckSiteKey && !globalThis.__spotlyAppCheck) {
    try {
      globalThis.__spotlyAppCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      });
      globalThis.__spotlyAppCheckError = null;
    } catch (error) {
      globalThis.__spotlyAppCheckError = error;
      console.error("Spotly App Check initialization failed.", error);
    }
  }

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
  const functions = getFunctions(app, process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || SPOTLY_FIREBASE_FUNCTIONS_REGION);
  const realtime = getDatabase(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || SPOTLY_FIREBASE_DATABASE_URL);

  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true" && !globalThis.__spotlyFirebaseEmulatorsConnected) {
    globalThis.__spotlyFirebaseEmulatorsConnected = true;
    const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
    try { connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true }); } catch {}
    try { connectFirestoreEmulator(db, host, 8080); } catch {}
    try { connectStorageEmulator(storage, host, 9199); } catch {}
    try { connectFunctionsEmulator(functions, host, 5001); } catch {}
    try { connectDatabaseEmulator(realtime, host, 9000); } catch {}
  }

  return { app, auth, db, storage, functions, realtime, config: firebaseConfig };
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
    const token = (await getAppCheckToken(appCheck, false)).token || "";
    globalThis.__spotlyAppCheckError = null;
    return token;
  } catch (error) {
    globalThis.__spotlyAppCheckError = error;
    if (!globalThis.__spotlyAppCheckTokenErrorLogged) {
      globalThis.__spotlyAppCheckTokenErrorLogged = true;
      console.error("Spotly App Check could not obtain an attestation token.", error);
    }
    return "";
  }
}

export function getFirebaseAppCheckStatus() {
  return {
    configured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY),
    initialized: Boolean(globalThis.__spotlyAppCheck),
    error: globalThis.__spotlyAppCheckError || null
  };
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


export function getFirebasePerformance() {
  if (typeof window === "undefined") return null;
  const sdk = getFirebaseClient();
  if (!sdk) return null;
  if (!performanceInstance) {
    try {
      performanceInstance = getPerformance(sdk.app);
      const enabled = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_FIREBASE_PERFORMANCE_ENABLED !== "false";
      performanceInstance.dataCollectionEnabled = enabled;
      performanceInstance.instrumentationEnabled = enabled;
    } catch { return null; }
  }
  return performanceInstance;
}

export function getFirebaseFunctions() {
  return getFirebaseClient()?.functions || null;
}

export function getFirebaseRealtimeDatabase() {
  return getFirebaseClient()?.realtime || null;
}

export async function callFirebaseFunction(name, data = {}) {
  const functions = getFirebaseFunctions();
  if (!functions) throw new Error("Firebase Functions is not configured in this browser.");
  const result = await httpsCallable(functions, name)(data);
  return result.data;
}

export { firebaseConfig };
