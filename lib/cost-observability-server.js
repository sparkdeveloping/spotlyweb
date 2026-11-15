import "server-only";

// C0: Privacy-minimal, opt-in route telemetry. Logs contain only allowlisted
// dimensions; never request parameters, UID/IP, positions, tokens or documents.
// Cloud logs have their own costs: sampling is intentionally bounded.
const ROUTES = new Set(["driver.bootstrap", "driver.live", "public.service-feed", "admin.driver-network"]);
const FIELDS = ["durationMs", "queryCount", "estimatedReadFloor", "docsFetched", "recordsReturned", "cacheMode", "cacheHit", "cacheFallback"];

export function recordCostEvent(route, metrics = {}) {
  if (process.env.SPOTLY_COST_TELEMETRY !== "true" || !ROUTES.has(route)) return;
  const proposed = Number(process.env.SPOTLY_COST_TELEMETRY_SAMPLE_RATE ?? 0.05);
  const sampleRate = Number.isFinite(proposed) ? Math.max(0, Math.min(1, proposed)) : 0.05;
  if (Math.random() >= sampleRate) return;
  const fields = {};
  for (const key of FIELDS) {
    if (!Object.hasOwn(metrics, key)) continue;
    if (["cacheMode"].includes(key)) {
      if (["local", "shared", "fallback", "none"].includes(metrics[key])) fields[key] = metrics[key];
    } else if (["cacheHit", "cacheFallback"].includes(key)) {
      if (typeof metrics[key] === "boolean") fields[key] = metrics[key];
    } else {
      const value = Number(metrics[key]);
      if (Number.isFinite(value) && value >= 0) fields[key] = Math.min(1_000_000, Math.round(value));
    }
  }
  console.info(JSON.stringify({ event: "spotly.cost.v1", route, sampleRate, ...fields }));
}
