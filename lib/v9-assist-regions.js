/**
 * Spotly V9 regional service policy. An unset location switch means available
 * for review (admin may turn it off); actual fulfilment requires operator readiness.
 * Explicit country/service disabled takes precedence over any branch default.
 */
export const AFRICAN_COUNTRY_SEEDS = Object.freeze([
  { code: "ZW", name: "Zimbabwe", currency: "USD", timezone: "Africa/Harare", cities: ["Harare","Bulawayo","Chitungwiza","Mutare","Gweru","Masvingo","Kwekwe","Kadoma","Chinhoyi","Marondera","Victoria Falls"] },
  { code: "MW", name: "Malawi", currency: "MWK", timezone: "Africa/Blantyre", cities: ["Lilongwe","Blantyre","Mzuzu","Zomba","Kasungu","Mangochi","Salima","Karonga"] }
]);
export const ASSIST_SERVICES = Object.freeze(["eat","shop","book"]);
const normalize = value => String(value || "").trim().toLowerCase();
export function locationCanAccept(record = {}) {
  return record.assistAccepting !== false && record.status === "published" && record.operationalReviewed === true;
}
export function regionalServicePolicy(config = {}, location = {}, service = "eat") {
  if (!ASSIST_SERVICES.includes(service)) return { available: false, reason: "unsupported_service" };
  const country = String(location.country || "ZW").toUpperCase();
  const city = normalize(location.city);
  const area = normalize(location.area);
  const entries = Array.isArray(config.regions) ? config.regions : [];
  let chosen = null;
  let priority = -1;
  for (const entry of entries) {
    if (String(entry.country || "").toUpperCase() !== country) continue;
    if (entry.city && normalize(entry.city) !== city) continue;
    if (entry.area && normalize(entry.area) !== area) continue;
    if (entry.service && entry.service !== service) continue;
    const p = (entry.city ? 2 : 0) + (entry.area ? 4 : 0) + (entry.service ? 1 : 0);
    if (p > priority) { chosen = entry; priority = p; }
  }
  if (chosen?.enabled === false) return { available: false, reason: "disabled_for_area" };
  const countryPolicy = config.countries?.[country] || {};
  if (countryPolicy.enabled === false || countryPolicy.services?.[service] === false) {
    return { available: false, reason: "disabled_for_country" };
  }
  // Launch policy: Zimbabwe supports assisted Eat/Shop/Book. Malawi launches with Ride only.
  // Other countries remain off until explicitly enabled by Admin. A missing flag never activates a new country.
  if (country !== "ZW" && countryPolicy.services?.[service] !== true) {
    return { available: false, reason: "not_launched_in_country" };
  }
  return { available: true, reason: "eligible_for_review" };
}
export function operationalAssistAvailable(config = {}, store = {}, service = "eat") {
  const location = { country: store.country || "ZW", city: store.city, area: store.area };
  const regional = regionalServicePolicy(config, location, service);
  return { ...regional, available: regional.available && locationCanAccept(store), eligible: regional.available, reviewed: store.operationalReviewed === true };
}
