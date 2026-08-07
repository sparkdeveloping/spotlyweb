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
