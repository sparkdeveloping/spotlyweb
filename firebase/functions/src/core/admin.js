import { getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { SPOTLY_DATABASE_URL, SPOTLY_PROJECT_ID } from "./platform.js";

export function getSpotlyAdminApp() {
  const existing = getApps()[0];
  if (existing) {
    const projectId = existing.options?.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId && !String(projectId).startsWith("demo-") && projectId !== SPOTLY_PROJECT_ID) {
      throw new Error(`Spotly Functions project mismatch: expected ${SPOTLY_PROJECT_ID}, received ${projectId}.`);
    }
    return existing;
  }

  const runtimeProjectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || SPOTLY_PROJECT_ID;
  const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  return initializeApp({
    projectId: runtimeProjectId,
    databaseURL: emulatorHost ? `http://${emulatorHost}?ns=${runtimeProjectId}` : SPOTLY_DATABASE_URL,
    storageBucket: emulatorHost ? `${runtimeProjectId}.appspot.com` : `${SPOTLY_PROJECT_ID}.firebasestorage.app`
  });
}

export function spotlyAdmin() {
  const app = getSpotlyAdminApp();
  return {
    app,
    auth: getAuth(app),
    appCheck: getAppCheck(app),
    firestore: getFirestore(app),
    database: getDatabase(app),
    messaging: getMessaging(app),
    storage: getStorage(app)
  };
}
