export const SPOTLY_DOMAINS = Object.freeze({
  customer: "https://spotlyafrica.com",
  business: "https://business.spotlyafrica.com",
  admin: "https://admin.spotlyafrica.com",
  driver: "https://driver.spotlyafrica.com",
  staff: "https://staff.spotlyafrica.com"
});

export function spotlyPortalUrl(portal, path = "") {
  const base = SPOTLY_DOMAINS[portal] || SPOTLY_DOMAINS.customer;
  const suffix = path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${base}${suffix}`;
}
