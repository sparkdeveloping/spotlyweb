import "server-only";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

function serviceAccountCredential() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.VERCEL !== "1") {
    return applicationDefault();
  }

  return null;
}

export function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const credential = serviceAccountCredential();
  if (!credential) {
    throw new Error(
      "Firebase Admin is not configured. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY to Vercel."
    );
  }

  return initializeApp({
    credential,
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

export function getAdminServices() {
  const app = getAdminApp();
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    messaging: getMessaging(app),
    storage: getStorage(app)
  };
}

export async function verifyAppCheckRequest(request, { required = process.env.SPOTLY_ENFORCE_APP_CHECK === "true" } = {}) {
  if (!required) return null;
  const token = request.headers.get("x-firebase-appcheck") || "";
  if (!token) throw Object.assign(new Error("Application verification is required."), { status: 401 });
  try {
    return await getAppCheck(getAdminApp()).verifyToken(token);
  } catch {
    throw Object.assign(new Error("Application verification failed."), { status: 401 });
  }
}

export async function authenticateRequest(request, { roles = [], permissions = [], optional = false } = {}) {
  await verifyAppCheckRequest(request);
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    if (optional) return null;
    throw Object.assign(new Error("Authentication is required."), { status: 401 });
  }

  const { auth, db } = getAdminServices();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token, true);
  } catch {
    throw Object.assign(new Error("The authentication token is invalid or expired."), { status: 401 });
  }

  const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
  if (profile.status === "suspended" || profile.status === "disabled") {
    throw Object.assign(new Error("This account is not active."), { status: 403 });
  }

  const userRoles = new Set(profile.roles || []);
  const userPermissions = new Set(profile.customPermissions || []);
  const superAdmin = userRoles.has("super_admin") || userPermissions.has("*");

  if (!superAdmin && roles.length && !roles.some((role) => userRoles.has(role))) {
    throw Object.assign(new Error("Your account does not have the required role."), { status: 403 });
  }
  if (!superAdmin && permissions.length && !permissions.every((permission) => userPermissions.has(permission))) {
    throw Object.assign(new Error("Your account does not have the required permission."), { status: 403 });
  }

  return { ...decoded, profile };
}

export function apiError(error) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "The server could not complete this request." : error.message;
  if (status >= 500) console.error(error);
  return Response.json({ ok: false, error: message }, { status });
}
