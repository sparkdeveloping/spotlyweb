import "server-only";

import { createHash } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { SPOTLY_FIREBASE_DATABASE_URL, SPOTLY_FIREBASE_PROJECT_ID, SPOTLY_FIREBASE_WEB_CONFIG } from "./firebase-project-config";

function configuredAdminProjectId() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || SPOTLY_FIREBASE_PROJECT_ID;
  if (projectId !== SPOTLY_FIREBASE_PROJECT_ID) {
    throw new Error(
      `Firebase Admin project mismatch: expected ${SPOTLY_FIREBASE_PROJECT_ID}, received ${projectId}. ` +
      "Do not run Spotly with client and Admin SDKs connected to different Firebase projects."
    );
  }
  return projectId;
}

function serviceAccountCredential() {
  const projectId = configuredAdminProjectId();
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
  if (getApps().length) {
    const existing = getApps()[0];
    const existingProjectId = existing.options?.projectId;
    if (existingProjectId && existingProjectId !== SPOTLY_FIREBASE_PROJECT_ID) {
      throw new Error(
        `Firebase Admin app mismatch: expected ${SPOTLY_FIREBASE_PROJECT_ID}, received ${existingProjectId}.`
      );
    }
    return existing;
  }

  const credential = serviceAccountCredential();
  if (!credential) {
    throw new Error(
      "Firebase Admin is not configured. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY to Vercel."
    );
  }

  return initializeApp({
    credential,
    projectId: configuredAdminProjectId(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || SPOTLY_FIREBASE_WEB_CONFIG.storageBucket,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || SPOTLY_FIREBASE_DATABASE_URL
  });
}

export function getAdminServices() {
  const app = getAdminApp();
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    database: getDatabase(app),
    messaging: getMessaging(app),
    storage: getStorage(app)
  };
}

function defaultAppCheckRequired() {
  if (process.env.SPOTLY_ENFORCE_APP_CHECK === "false") return false;
  if (process.env.SPOTLY_ENFORCE_APP_CHECK === "true") return true;
  return process.env.NODE_ENV === "production";
}

export async function verifyAppCheckRequest(request, { required = defaultAppCheckRequired() } = {}) {
  if (!required) return null;
  const token = request.headers.get("x-firebase-appcheck") || "";
  if (!token) throw Object.assign(new Error("Application verification is required."), { status: 401, code: "app-check-required" });
  try {
    return await getAppCheck(getAdminApp()).verifyToken(token);
  } catch {
    throw Object.assign(new Error("Application verification failed."), { status: 401, code: "app-check-invalid" });
  }
}

async function enforceAuthenticatedMutationRate(request, db, uid) {
  const method = String(request.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const pathname = request.nextUrl?.pathname || (() => { try { return new URL(request.url).pathname; } catch { return "/api"; } })();
  const windowMs = 60_000;
  const limit = pathname.includes("/auth/session") ? 30 : pathname.includes("/payout") || pathname.includes("/refund") ? 20 : 120;
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const digest = createHash("sha256").update(`${uid}|${pathname}|${bucket}`).digest("hex").slice(0, 48);
  const ref = db.collection("securityRateLimits").doc(`api_${digest}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
    if (current >= limit) throw Object.assign(new Error("Too many requests. Try again shortly."), { status: 429, code: "rate-limited" });
    transaction.set(ref, {
      surface: "web_api",
      route: pathname.slice(0, 180),
      actorHash: createHash("sha256").update(uid).digest("hex"),
      bucket,
      count: current + 1,
      expiresAt: Timestamp.fromMillis((bucket + 2) * windowMs),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
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

  await enforceAuthenticatedMutationRate(request, db, decoded.uid);

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
  if (status >= 500) console.error(JSON.stringify({ severity: "ERROR", event: "api_error", code: error?.code || "internal", message: error?.message || String(error), stack: error?.stack || null }));
  else if (status === 429 || status === 401 || status === 403) console.warn(JSON.stringify({ severity: "WARNING", event: "api_rejected", status, code: error?.code || null, message: error?.message || "Request rejected" }));
  return Response.json({ ok: false, error: message, ...(error?.code ? { code: String(error.code) } : {}), ...(error?.serviceAvailability ? { serviceAvailability: error.serviceAvailability } : {}) }, { status });
}
