/** LX1: strictly bounded, privacy-preserving browser failure envelope.
 * Raw error messages, URL queries, stacks, IDs, coordinates and payment data
 * are intentionally NOT accepted from clients.
 */
export const INCIDENT_SURFACES = new Set(["page-boundary", "global-boundary"]);
export const INCIDENT_CLASSES = new Set(["Error", "TypeError", "NetworkError", "ChunkLoadError", "Other"]);

export function safeIncidentScreen(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  // Never retain dynamic URL segments, search, fragments or IDs.
  const first = value.split(/[?#]/, 1)[0].split("/").filter(Boolean)[0] || "";
  return /^[a-z][a-z-]{0,31}$/i.test(first) ? `/${first.toLowerCase()}` : "/";
}

export function normalizeClientIncident(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const surface = payload.surface;
  if (!INCIDENT_SURFACES.has(surface)) return null;
  const className = INCIDENT_CLASSES.has(payload.errorClass) ? payload.errorClass : "Other";
  const digest = typeof payload.digest === "string" && /^[a-zA-Z0-9_-]{1,72}$/.test(payload.digest)
    ? payload.digest : null;
  return Object.freeze({ surface, errorClass: className, digest, screen: safeIncidentScreen(payload.screen) });
}

export function friendlyBoundaryMessage() {
  return {
    title: "This screen couldn't load.",
    body: "Try opening it again. If you were booking, ordering or paying, check Activity before submitting another request.",
    retry: "Try again",
    support: "Contact support",
  };
}
