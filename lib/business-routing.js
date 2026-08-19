import { normalizePortalPath } from "./spotly-domains.js";

export const BUSINESS_ACCOUNT_SECTIONS = new Set(["portfolio", "notifications", "claims", "invitations", "access"]);

export function businessHref(path, { businessId = "", ...params } = {}) {
  const [rawPathname, existingQuery = ""] = String(path || "/business").split("?");
  const pathname = normalizePortalPath("business", rawPathname);
  const search = new URLSearchParams(existingQuery);
  if (businessId) search.set("business", businessId);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) search.delete(key);
    else search.set(key, String(value));
  });
  const query = search.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function businessSectionFromPath(pathname = "/") {
  const clean = normalizePortalPath("business", pathname);
  const parts = String(clean).split("/").filter(Boolean);
  if (!parts.length) return "portfolio";
  return parts[0] || "portfolio";
}

export function isBusinessAccountSection(section) {
  return BUSINESS_ACCOUNT_SECTIONS.has(section);
}

export function isBusinessKioskLivePath(pathname = "/") {
  const clean = normalizePortalPath("business", pathname);
  return clean === "/kiosk/live" || clean.startsWith("/kiosk/live/");
}
