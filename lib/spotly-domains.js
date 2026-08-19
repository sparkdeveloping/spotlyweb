export const SPOTLY_DOMAINS = Object.freeze({
  customer: "https://spotlyafrica.com",
  business: "https://business.spotlyafrica.com",
  admin: "https://admin.spotlyafrica.com",
  driver: "https://driver.spotlyafrica.com",
  staff: "https://staff.spotlyafrica.com"
});

export const PORTAL_PREFIXES = Object.freeze({
  business: "/business",
  admin: "/admin",
  driver: "/driver",
  staff: "/staff"
});

const GLOBAL_CUSTOMER_PREFIXES = [
  "/account", "/marketplace", "/support", "/privacy", "/terms", "/claim", "/drive", "/payment"
];

export function spotlyPortalUrl(portal, path = "") {
  const base = SPOTLY_DOMAINS[portal] || SPOTLY_DOMAINS.customer;
  const suffix = path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${base}${suffix}`;
}

export function portalForPath(path = "") {
  const pathname = String(path || "").split("?")[0].split("#")[0];
  for (const [portal, prefix] of Object.entries(PORTAL_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return portal;
  }
  return null;
}

export function stripPortalPrefix(portal, href = "/") {
  const prefix = PORTAL_PREFIXES[portal];
  if (!prefix) return href || "/";
  const raw = String(href || "/");
  const match = raw.match(/^([^?#]*)([?#].*)?$/);
  const pathname = match?.[1] || "/";
  const suffix = match?.[2] || "";
  if (pathname === prefix) return `/${suffix}`.replace("/?", "?").replace("/#", "#") || "/";
  if (pathname.startsWith(`${prefix}/`)) return `${pathname.slice(prefix.length) || "/"}${suffix}`;
  return raw;
}

export function isLegacyPortalPath(portal, pathname = "") {
  const prefix = PORTAL_PREFIXES[portal];
  return Boolean(prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

export function resolveSpotlyHref(href, { currentPortal = "customer", legacyMode = false } = {}) {
  const raw = String(href || "/");
  if (/^(?:https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (!raw.startsWith("/")) return raw;

  const targetPortal = portalForPath(raw);
  if (targetPortal) {
    const clean = stripPortalPrefix(targetPortal, raw);
    if (targetPortal === currentPortal) return legacyMode ? raw : clean;
    return spotlyPortalUrl(targetPortal, clean);
  }

  if (raw === "/") return currentPortal === "customer" ? "/" : SPOTLY_DOMAINS.customer;
  const globalCustomerRoute = GLOBAL_CUSTOMER_PREFIXES.some((prefix) => raw === prefix || raw.startsWith(`${prefix}/`) || raw.startsWith(`${prefix}?`) || raw.startsWith(`${prefix}#`));
  if (globalCustomerRoute && currentPortal !== "customer") return spotlyPortalUrl("customer", raw);
  return raw;
}

export function resolvePortalNavigation(portal, nav = [], pathname = "") {
  const legacyMode = isLegacyPortalPath(portal, pathname);
  return nav.map((item) => ({ ...item, href: resolveSpotlyHref(item.href, { currentPortal: portal, legacyMode }) }));
}

export function isAllowedSpotlyDestination(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "spotlyafrica.com" || url.hostname === "www.spotlyafrica.com" || Object.values(SPOTLY_DOMAINS).some((base) => new URL(base).hostname === url.hostname));
  } catch {
    return false;
  }
}

export function safeSpotlyDestination(value, fallback = "/") {
  return isAllowedSpotlyDestination(value) ? String(value) : fallback;
}
