/**
 * Data shared by an independent restaurant-directory source is not evidence
 * of merchant approval, stock, or a guaranteed price.
 *
 * Authorized partners' photos must be copied to approved Spotly storage,
 * linked to the exact restaurant location, and recorded with the usage grant.
 * Never hotlink or relabel a third-party directory photograph as merchant-owned.
 */
export const THEMENU_SOURCE = "The Menu";
export const RESTAURANT_MENU_RECHECK_DAYS = 14;

export function approvedTheMenuPhoto(record = {}) {
  const evidence = record.partnerMedia;
  const source = record.source || {};
  if (source.type !== "themenu_partner" || source.rightsStatus !== "licensed" ||
      evidence?.sourceName !== THEMENU_SOURCE || evidence?.usageApproved !== true ||
      evidence?.locationMatched !== true || !evidence?.sourceUrl?.startsWith("https://themenu.co.zw/") ||
      !evidence?.storedUrl?.startsWith("https://firebasestorage.googleapis.com/")) return null;
  return { src: evidence.storedUrl, kind: "licensed-directory", label: "Photo: The Menu (licensed)", sourceUrl: evidence.sourceUrl };
}

export function partnerMenuFreshness(record = {}, now = Date.now()) {
  const checkedAt = record?.menu?.lastCheckedAt || record?.source?.lastMenuCheckedAt;
  if (!checkedAt) return { state: "unverified", label: "Menu and price freshness not verified" };
  const stamp = new Date(checkedAt).getTime();
  if (!Number.isFinite(stamp) || stamp > now + 60000) return { state: "unverified", label: "Menu and price freshness not verified" };
  const ageDays = Math.max(0, (now - stamp) / 86400000);
  if (ageDays > RESTAURANT_MENU_RECHECK_DAYS) return { state: "stale", label: "Menu may have changed — request a current price check" };
  return { state: "recent", label: "Source menu reviewed recently · prices subject to confirmation" };
}
