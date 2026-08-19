import "server-only";

export const SHARED_SESSION_COOKIE = "spotly_session";
export const SHARED_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SHARED_SESSION_MAX_AGE_MS = SHARED_SESSION_MAX_AGE_SECONDS * 1000;

export function requestHostname(request) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

export function isSpotlyProductionHostname(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return host === "spotlyafrica.com" || host === "www.spotlyafrica.com" || host.endsWith(".spotlyafrica.com");
}

export function validateSameSiteOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost = "";
  try { originHost = new URL(origin).hostname.toLowerCase(); } catch { return false; }
  const requestHost = requestHostname(request);
  if (isSpotlyProductionHostname(requestHost)) return isSpotlyProductionHostname(originHost);
  return originHost === requestHost || ["localhost", "127.0.0.1"].includes(originHost);
}

export function readCookie(request, name = SHARED_SESSION_COOKIE) {
  const header = request.headers.get("cookie") || "";
  for (const chunk of header.split(";")) {
    const index = chunk.indexOf("=");
    if (index < 0) continue;
    const key = chunk.slice(0, index).trim();
    if (key !== name) continue;
    return decodeURIComponent(chunk.slice(index + 1).trim());
  }
  return "";
}

export function sharedSessionCookieHeader(request, value, { clear = false } = {}) {
  const host = requestHostname(request);
  const production = isSpotlyProductionHostname(host);
  const parts = [`${SHARED_SESSION_COOKIE}=${clear ? "" : encodeURIComponent(value || "")}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (production) {
    parts.push("Secure", "Domain=.spotlyafrica.com");
  }
  parts.push(`Max-Age=${clear ? 0 : SHARED_SESSION_MAX_AGE_SECONDS}`);
  if (clear) parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  return parts.join("; ");
}
