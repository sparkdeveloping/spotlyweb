import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { spotlyAdmin } from "./admin.js";
import { requestFingerprint, scopedIdempotencyKey } from "./fingerprint.js";

export async function runIdempotent({ scope, uid, idempotencyKey, payload, ttlSeconds = 86_400, execute }) {
  if (!scope || !uid || !idempotencyKey) throw new HttpsError("invalid-argument", "An idempotency key is required.");
  if (String(idempotencyKey).length > 180) throw new HttpsError("invalid-argument", "The idempotency key is too long.");
  const { firestore } = spotlyAdmin();
  const fingerprint = requestFingerprint(payload);
  const ref = firestore.collection("functionIdempotency").doc(scopedIdempotencyKey(scope, uid, String(idempotencyKey)));
  const now = Date.now();
  let replay;

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const current = snapshot.data();
      if (current.fingerprint !== fingerprint) throw new HttpsError("already-exists", "This idempotency key was already used for another request.");
      if (current.state === "completed") {
        replay = current.result;
        return;
      }
      const leaseUntil = current.leaseUntil?.toMillis?.() || 0;
      if (current.state === "in_progress" && leaseUntil > now) throw new HttpsError("aborted", "This request is already being processed. Retry shortly.");
    }
    transaction.set(ref, {
      scope,
      uid,
      fingerprint,
      state: "in_progress",
      ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
      leaseUntil: Timestamp.fromMillis(now + 60_000),
      expiresAt: Timestamp.fromMillis(now + ttlSeconds * 1000)
    }, { merge: true });
  });

  if (replay !== undefined) return { replayed: true, value: replay };
  try {
    const value = await execute();
    await ref.set({ state: "completed", result: value ?? null, updatedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { replayed: false, value };
  } catch (error) {
    await ref.set({ state: "failed", updatedAt: FieldValue.serverTimestamp(), leaseUntil: Timestamp.fromMillis(0) }, { merge: true }).catch(() => {});
    throw error;
  }
}
