import "server-only";

import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebase-admin";

function requestIdentity(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function enforceRateLimit(request, { key, limit = 10, windowMs = 15 * 60_000, identity } = {}) {
  if (!key) throw new Error("A rate-limit key is required.");
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const subject = identity || requestIdentity(request);
  const digest = createHash("sha256").update(`${key}|${subject}|${bucket}`).digest("hex").slice(0, 40);
  const { db } = getAdminServices();
  const ref = db.collection("rateLimits").doc(`${key}_${digest}`);
  let remaining = limit;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
    if (current >= limit) {
      const error = Object.assign(new Error("Too many requests. Try again shortly."), { status: 429 });
      throw error;
    }
    const next = current + 1;
    remaining = Math.max(0, limit - next);
    transaction.set(ref, {
      key,
      bucket,
      count: next,
      expiresAt: Timestamp.fromMillis((bucket + 2) * windowMs),
      updatedAt: Timestamp.now()
    }, { merge: true });
  });

  return { remaining, resetAt: new Date((bucket + 1) * windowMs).toISOString() };
}

/**
 * Check multiple independent quota scopes atomically. A rejected per-contact
 * retry must not consume an unrelated applicant's shared-network allowance.
 * No raw email, phone, or IP is stored in the quota document ID.
 */
export async function enforceRateLimits(request, rules = []) {
  if (!Array.isArray(rules) || rules.length === 0) throw new Error("At least one rate-limit rule is required.");
  const now = Date.now();
  const { db } = getAdminServices();
  const quotas = rules.map(({ key, limit = 10, windowMs = 15 * 60_000, identity, scope = "request" }) => {
    if (!key || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
      throw new Error("Invalid rate-limit rule.");
    }
    const bucket = Math.floor(now / windowMs);
    const subject = identity || requestIdentity(request);
    const digest = createHash("sha256").update(`${key}|${subject}|${bucket}`).digest("hex").slice(0, 40);
    return {
      key, limit, windowMs, bucket, scope,
      ref: db.collection("rateLimits").doc(`${key}_${digest}`),
      retryAfterSeconds: Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000)),
    };
  });

  await db.runTransaction(async (transaction) => {
    // Firestore requires ALL reads to happen before ANY write in a transaction.
    const snapshots = await Promise.all(quotas.map((quota) => transaction.get(quota.ref)));
    for (let i = 0; i < quotas.length; i++) {
      const quota = quotas[i];
      const current = snapshots[i].exists ? Number(snapshots[i].data()?.count || 0) : 0;
      if (current >= quota.limit) {
        throw Object.assign(new Error("Too many requests. Try again shortly."), {
          status: 429,
          code: "rate-limited",
          scope: quota.scope,
          retryAfterSeconds: quota.retryAfterSeconds,
        });
      }
    }
    for (let i = 0; i < quotas.length; i++) {
      const quota = quotas[i];
      const current = snapshots[i].exists ? Number(snapshots[i].data()?.count || 0) : 0;
      transaction.set(quota.ref, {
        key: quota.key,
        bucket: quota.bucket,
        count: current + 1,
        expiresAt: Timestamp.fromMillis((quota.bucket + 2) * quota.windowMs),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
  });
}
