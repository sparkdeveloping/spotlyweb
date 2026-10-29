export const SPOTLY_DOMAINS = Object.freeze({
  customer: "https://spotlyafrica.com",
  business: "https://business.spotlyafrica.com",
  admin: "https://admin.spotlyafrica.com",
  driver: "https://driver.spotlyafrica.com",
  staff: "https://staff.spotlyafrica.com",
  careers: "https://careers.spotlyafrica.com",
  nxt: "https://nxt.spotlyafrica.com"
});

export const PORTAL_PREFIXES = Object.freeze({
  business: "/business",
  admin: "/admin",
  driver: "/driver",
  staff: "/staff",
  careers: "/careers",
  nxt: "/nxt"
});

export const PORTAL_ROOT_SECTIONS = Object.freeze({
  business: "portfolio",
  admin: "dashboard",
  driver: "home",
  staff: "today",
  careers: "home",
  nxt: "home",
  customer: "home"
});

const GLOBAL_CUSTOMER_PREFIXES = [
  "/branding", "/account", "/marketplace", "/privacy", "/terms", "/claim", "/drive", "/payment", "/saved", "/search", "/place", "/item", "/order"
];

export const PORTAL_LOCAL_SECTIONS = Object.freeze({
  business: new Set(["get-started", "claim-status", "notifications", "claims", "invitations", "access", "launch", "setup", "today", "activity", "catalog", "branches", "delivery", "kiosk", "insights", "promotions", "staff", "finance", "support", "settings"]),
  admin: new Set(["home", "work", "marketplace", "mobility", "money", "growth", "team", "system", "operations", "notifications", "organizations", "businesses", "people", "drivers", "customers", "finance", "content", "platform-map", "platform", "audit", "settings", "queues", "support-view", "assist", "assist-coverage", "assist-import", "assist-research", "assist-menu-launch", "assist-fulfillment", "independent-shopping", "business-register", "guide"]),
  driver: new Set(["jobs", "active", "assist-shopping", "earnings", "history", "notifications", "support", "profile"]),
  staff: new Set(["onboard", "work", "catalogue", "team", "hiring", "schedule", "leave", "learning", "performance", "pay", "assets", "notifications", "help", "profile"]),
  careers: new Set(["jobs", "apply", "application"]),
  nxt: new Set(["login"]),
  customer: new Set(["marketplace", "account", "activity", "saved", "search", "place", "item", "order", "support", "privacy", "terms", "claim", "drive", "payment"])
});

export function isLocalPortalSection(portal, pathname = "/") {
  const firstSegment = splitHref(pathname).pathname.split("/").filter(Boolean)[0];
  return Boolean(firstSegment && PORTAL_LOCAL_SECTIONS[portal]?.has(firstSegment));
}

function splitHref(value = "/") {
  const raw = String(value || "/");
  const match = raw.match(/^([^?#]*)([?#].*)?$/);
  return { pathname: match?.[1] || "/", suffix: match?.[2] || "" };
}

export function spotlyPortalUrl(portal, path = "") {
  const targetPortal = SPOTLY_DOMAINS[portal] ? portal : "customer";
  const base = SPOTLY_DOMAINS[targetPortal];
  const rawPath = path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : "/";
  const cleanPath = targetPortal === "customer" ? rawPath : stripPortalPrefix(targetPortal, rawPath);
  const suffix = cleanPath && cleanPath !== "/" ? cleanPath : "";
  return `${base}${suffix}`;
}

export function spotlyLoginUrl(portal = "customer", { next = "/", mode = "signin" } = {}) {
  const targetPortal = SPOTLY_DOMAINS[portal] ? portal : "customer";
  const params = new URLSearchParams();
  if (targetPortal !== "customer") params.set("portal", targetPortal);
  if (mode === "signup") params.set("mode", "signup");
  const safeNext = safeSpotlyDestination(next, targetPortal === "customer" ? "/account" : "/");
  if (safeNext) params.set("next", safeNext);
  const login = spotlyPortalUrl(targetPortal, "/login");
  const query = params.toString();
  return query ? `${login}?${query}` : login;
}


export function portalForHostname(hostname = "") {
  const host = String(hostname || "").split(":")[0].trim().toLowerCase();
  if (host === "business.spotlyafrica.com") return "business";
  if (host === "admin.spotlyafrica.com") return "admin";
  if (host === "driver.spotlyafrica.com") return "driver";
  if (host === "staff.spotlyafrica.com") return "staff";
  if (host === "nxt.spotlyafrica.com") return "nxt";
  return "customer";
}

export function portalForPath(path = "") {
  const pathname = splitHref(path).pathname;
  for (const [portal, prefix] of Object.entries(PORTAL_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return portal;
  }
  return null;
}

export function stripPortalPrefix(portal, href = "/") {
  const prefix = PORTAL_PREFIXES[portal];
  if (!prefix) return href || "/";
  const { pathname, suffix } = splitHref(href);
  if (pathname === prefix) return suffix ? `/${suffix}`.replace("/?", "?").replace("/#", "#") : "/";
  if (pathname.startsWith(`${prefix}/`)) return `${pathname.slice(prefix.length) || "/"}${suffix}`;
  return String(href || "/");
}

export function normalizePortalPath(portal, pathname = "/") {
  const raw = splitHref(pathname).pathname || "/";
  const prefix = PORTAL_PREFIXES[portal];
  if (!prefix) return raw || "/";
  if (raw === prefix) return "/";
  if (raw.startsWith(`${prefix}/`)) return raw.slice(prefix.length) || "/";
  return raw || "/";
}

export function portalSectionFromPath(portal, pathname = "/", rootSection = PORTAL_ROOT_SECTIONS[portal] || "home") {
  const clean = normalizePortalPath(portal, pathname);
  const parts = clean.split("/").filter(Boolean);
  return parts[0] || rootSection;
}

export function isPortalPath(portal, pathname = "/") {
  const prefix = PORTAL_PREFIXES[portal];
  if (!prefix) return false;
  const raw = splitHref(pathname).pathname;
  return raw === prefix || raw.startsWith(`${prefix}/`);
}

export function isLegacyPortalPath(portal, pathname = "") {
  return isPortalPath(portal, pathname);
}

export function resolveSpotlyHref(href, { currentPortal = "customer", legacyMode = false } = {}) {
  const raw = String(href || "/");
  if (/^(?:mailto:|tel:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return canonicalSpotlyUrl(raw, currentPortal);
  if (!raw.startsWith("/")) return raw;

  if (isLocalPortalSection(currentPortal, raw)) return raw;

  const targetPortal = portalForPath(raw);
  if (targetPortal) {
    const clean = stripPortalPrefix(targetPortal, raw);
    if (targetPortal === currentPortal) return legacyMode ? raw : clean;
    return spotlyPortalUrl(targetPortal, clean);
  }

  if (raw === "/") return "/";
  const globalCustomerRoute = GLOBAL_CUSTOMER_PREFIXES.some((prefix) => raw === prefix || raw.startsWith(`${prefix}/`) || raw.startsWith(`${prefix}?`) || raw.startsWith(`${prefix}#`));
  if (globalCustomerRoute && currentPortal !== "customer") return spotlyPortalUrl("customer", raw);
  return raw;
}

export function resolvePortalNavigation(portal, nav = [], pathname = "") {
  const legacyMode = isLegacyPortalPath(portal, pathname);
  return nav.map((item) => ({ ...item, href: resolveSpotlyHref(item.href, { currentPortal: portal, legacyMode }) }));
}

export function activePortalNavigationId(portal, nav = [], pathname = "", fallback = "") {
  const cleanCurrent = normalizePortalPath(portal, pathname).replace(/\/+$/, "") || "/";
  let best = null;
  for (const item of nav) {
    const rawHref = String(item?.href || "");
    if (!rawHref || /^(?:https?:|mailto:|tel:)/i.test(rawHref)) continue;
    const hrefPath = splitHref(rawHref).pathname;
    const cleanTarget = normalizePortalPath(portal, hrefPath).replace(/\/+$/, "") || "/";
    const exact = cleanCurrent === cleanTarget;
    const nested = cleanTarget !== "/" && cleanCurrent.startsWith(`${cleanTarget}/`);
    if (!exact && !nested) continue;
    const score = cleanTarget.length + (exact ? 10000 : 0);
    if (!best || score > best.score) best = { id: item.id, score };
  }
  if (best?.id) return best.id;
  if (fallback && nav.some((item) => item.id === fallback)) return fallback;
  const rootId = PORTAL_ROOT_SECTIONS[portal];
  if (cleanCurrent === "/" && rootId && nav.some((item) => item.id === rootId)) return rootId;
  return fallback || rootId || nav[0]?.id || "";
}

export function canonicalSpotlyUrl(href = "", workspace = "customer") {
  const raw = String(href || "");
  if (!raw) return spotlyPortalUrl(workspace);
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const hostPortal = portalForHostname(url.hostname);
      const isSpotlyHost = url.hostname === "spotlyafrica.com" || url.hostname === "www.spotlyafrica.com" || Object.values(SPOTLY_DOMAINS).some((base) => new URL(base).hostname === url.hostname);
      if (!isSpotlyHost) return raw;
      const pathPortal = portalForPath(url.pathname);
      const customerRoute = GLOBAL_CUSTOMER_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
      const hostOwnsPath = isLocalPortalSection(hostPortal, url.pathname);
      const targetPortal = pathPortal || (hostOwnsPath ? hostPortal : (customerRoute ? "customer" : hostPortal));
      const cleanPath = pathPortal ? stripPortalPrefix(pathPortal, `${url.pathname}${url.search}${url.hash}`) : `${normalizePortalPath(targetPortal, url.pathname)}${url.search}${url.hash}`;
      return spotlyPortalUrl(targetPortal, cleanPath);
    } catch {
      return raw;
    }
  }
  const targetPortal = portalForPath(raw);
  if (targetPortal) return spotlyPortalUrl(targetPortal, stripPortalPrefix(targetPortal, raw));
  if (raw.startsWith("/")) {
    const localWorkspaceRoute = isLocalPortalSection(workspace, raw);
    const customerRoute = GLOBAL_CUSTOMER_PREFIXES.some((prefix) => raw === prefix || raw.startsWith(`${prefix}/`) || raw.startsWith(`${prefix}?`) || raw.startsWith(`${prefix}#`));
    return spotlyPortalUrl(localWorkspaceRoute ? workspace : (customerRoute ? "customer" : workspace), raw);
  }
  return spotlyPortalUrl(workspace, `/${raw}`);
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
