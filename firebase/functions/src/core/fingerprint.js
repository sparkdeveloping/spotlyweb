import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

export function requestFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stable(value ?? null))).digest("hex");
}

export function scopedIdempotencyKey(scope, uid, idempotencyKey) {
  return createHash("sha256").update(`${scope}:${uid}:${idempotencyKey}`).digest("hex");
}
