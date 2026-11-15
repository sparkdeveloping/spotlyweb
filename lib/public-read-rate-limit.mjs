/**
 * C3 opt-in, atomic distributed limiter for explicitly allowlisted PUBLIC GETs.
 * Not used for authentication, payments, registration, mutation or callable quotas.
 * This file deliberately has no Firebase/Next imports so its security boundary can
 * be exercised with an isolated local HTTP harness.
 */
import { createHmac } from "node:crypto";

const PUBLIC_GET_ROUTES = Object.freeze({
  "public-service-feed": "/api/public/service-feed",
  "public-search": "/api/public/search",
  "public-marketplace": "/api/public/marketplace",
  "public-marketplace-events": "/api/public/marketplace/events",
  "public-marketplace-business": "/api/public/marketplace/business",
  "public-marketplace-businesses": "/api/public/marketplace/businesses",
  "public-pickup-availability": "/api/public/marketplace/pickup-availability",
  "public-business-directory": "/api/public/directory",
  "public-business-directory-detail": "/api/public/directory/business",
  "public-discovery-v1": "/api/public/discovery",
  "public-runtime": "/api/public/runtime",
  "public-map-config": "/api/public/map-config",
  "public-service-availability": "/api/public/service-availability",
  "public-business-reviews": "/api/public/reviews",
  "public-independent-shopping": "/api/public/independent-shopping",
  "public_geocode": "/api/public/geocode",
  "public_reverse_geocode": "/api/public/reverse-geocode",
  "public-driver-acquisition-config": "/api/public/driver-acquisition",
  "claim_invite_prefill": "/api/public/claim-invite",
});

export function isPublicGetQuotaEligible(request, { key, identity } = {}) {
  if (request?.method !== "GET" || identity != null || typeof key !== "string") return false;
  const route = PUBLIC_GET_ROUTES[key];
  if (!route) return false;
  try { return new URL(request.url).pathname === route; }
  catch { return false; }
}

export function publicQuotaIdentity(request) {
  // Keep the pre-existing rate-limit identity behavior during this opt-in phase;
  // headers must be supplied by a trusted deployment proxy, not a raw client.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
}

export function publicQuotaKey({ key, subject, bucket, signingKey }) {
  if (!signingKey) throw new Error("Distributed quota key requires a signing secret.");
  // Keyed hashing avoids exposing raw or trivially reversible IP addresses in
  // Redis keys, while keeping all instances on one common quota namespace.
  const digest = createHmac("sha256", signingKey).update(`${key}|${subject}|${bucket}`).digest("hex").slice(0, 40);
  return `spotly:public-get-rl:v1:${key}:${digest}`;
}

// Single Lua operation: count never exceeds the quota and initial expiry is
// installed atomically. Using INCR + EXPIRE in two calls would permit races.
export const ATOMIC_FIXED_WINDOW_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then
  local used = tonumber(value)
  if used >= tonumber(ARGV[1]) then return {used, 0} end
  return {redis.call('INCR', KEYS[1]), 1}
end
redis.call('SET', KEYS[1], 1, 'PX', ARGV[2])
return {1, 1}
`;

export function configuredRedisUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    return parsed.origin;
  } catch { return null; }
}

/** Returns a normal rate-limit result or throws status=429 (never counts a rejected request). */
export async function enforceAtomicPublicGetQuota(request, {
  key, limit, windowMs, now = Date.now(),
  redisUrl, redisToken, fetcher = fetch, timeoutMs = 1600
} = {}) {
  if (!isPublicGetQuotaEligible(request, { key })) throw new Error("This route is not eligible for public GET quotas.");
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error("Invalid public quota.");
  const endpoint = configuredRedisUrl(redisUrl);
  if (!endpoint || !redisToken || typeof redisToken !== "string") throw new Error("Distributed quota is not configured.");
  const bucket = Math.floor(now / windowMs);
  const resetAtMs = (bucket + 1) * windowMs;
  const expiryMs = Math.max(1, (bucket + 2) * windowMs - now);
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Authorization": `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", ATOMIC_FIXED_WINDOW_SCRIPT, 1,
      publicQuotaKey({ key, subject: publicQuotaIdentity(request), bucket, signingKey: redisToken }), limit, expiryMs]),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Distributed quota endpoint unavailable.");
  const payload = await response.json();
  const result = payload?.result;
  const count = Number(result?.[0]);
  const permitted = Number(result?.[1]);
  if (payload?.error || !Array.isArray(result) || !Number.isSafeInteger(count) || count < 1 || count > limit || ![0, 1].includes(permitted)) {
    throw new Error("Unexpected distributed quota response.");
  }
  if (!permitted) {
    throw Object.assign(new Error("Too many requests. Try again shortly."), {
      status: 429, code: "rate-limited",
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    });
  }
  return { remaining: Math.max(0, limit - count), resetAt: new Date(resetAtMs).toISOString() };
}
