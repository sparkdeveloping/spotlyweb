export const BUSINESS_ACCOUNT_SECTIONS = new Set(["portfolio", "claims", "invitations", "access"]);

export function businessHref(path, { businessId = "", ...params } = {}) {
  const [pathname, existingQuery = ""] = String(path || "/business").split("?");
  const search = new URLSearchParams(existingQuery);
  if (businessId) search.set("business", businessId);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) search.delete(key);
    else search.set(key, String(value));
  });
  const query = search.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function businessSectionFromPath(pathname = "/business") {
  const parts = String(pathname).split("/").filter(Boolean);
  if (parts[0] !== "business") return "portfolio";
  if (parts.length === 1) return "portfolio";
  return parts[1] || "portfolio";
}

export function isBusinessAccountSection(section) {
  return BUSINESS_ACCOUNT_SECTIONS.has(section);
}
