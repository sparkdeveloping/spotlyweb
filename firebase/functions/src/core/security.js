import { createHash } from "node:crypto";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { spotlyAdmin } from "./admin.js";

function safeOperation(value) {
  return String(value || "callable").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120);
}

function requestIdentity(request) {
  if (request.auth?.uid) return `uid:${request.auth.uid}`;
  const appId = request.app?.appId || request.app?.token?.app_id || request.app?.token?.appId;
  if (appId) return `app:${appId}`;
  const ip = request.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || request.rawRequest?.ip || "anonymous";
  return `ip:${ip}`;
}

export async function enforceCallableRateLimit(request, { operation, limit = 120, windowMs = 60_000 } = {}) {
  if (!Number.isFinite(limit) || limit <= 0) return { remaining: null, resetAt: null };
  const op = safeOperation(operation);
  const identity = requestIdentity(request);
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const digest = createHash("sha256").update(`${op}|${identity}|${bucket}`).digest("hex").slice(0, 48);
  const { firestore } = spotlyAdmin();
  const ref = firestore.collection("securityRateLimits").doc(`${op}_${digest}`);
  let remaining = limit;

  try {
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
      if (current >= limit) {
        throw new HttpsError("resource-exhausted", "Too many requests. Try again shortly.");
      }
      const next = current + 1;
      remaining = Math.max(0, limit - next);
      transaction.set(ref, {
        operation: op,
        bucket,
        count: next,
        identityHash: createHash("sha256").update(identity).digest("hex"),
        expiresAt: Timestamp.fromMillis((bucket + 2) * windowMs),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
  } catch (error) {
    if (error instanceof HttpsError && error.code === "resource-exhausted") {
      logger.warn("Spotly callable rate limit exceeded", { operation: op, identityHash: createHash("sha256").update(identity).digest("hex").slice(0, 16) });
    }
    throw error;
  }
  return { remaining, resetAt: new Date((bucket + 1) * windowMs).toISOString() };
}

export function callableLogContext({ request, actor, requestId, operation, startedAt }) {
  return {
    requestId,
    operation: safeOperation(operation),
    actorId: actor?.uid || request.auth?.uid || null,
    authenticated: Boolean(actor?.uid || request.auth?.uid),
    appCheck: Boolean(request.app),
    appId: request.app?.appId || request.app?.token?.app_id || null,
    durationMs: Math.max(0, Date.now() - startedAt)
  };
}
