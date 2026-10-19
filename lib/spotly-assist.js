/**
 * Spotly Assist V9 policy.
 * Being present in the directory does not mean a merchant has partnered with Spotly.
 * Assisted requests are customer enquiries until the business/price is confirmed.
 */
export const ASSIST_MODES = Object.freeze(["shopping", "booking"]);
export const ASSIST_NOTICE = "Spotly Assist arranges this request independently. The business is not necessarily partnered with Spotly. Prices, services and availability are confirmed before any purchase or booking.";
export const ASSIST_STATES = Object.freeze([
  "pending_review", "contacting_business", "awaiting_customer", "awaiting_confirmation",
  "confirmed", "in_progress", "completed", "declined", "cancelled", "expired"
]);
export const ASSIST_TRANSITIONS = Object.freeze({
  pending_review: ["contacting_business", "awaiting_customer", "declined", "cancelled"],
  contacting_business: ["awaiting_customer", "awaiting_confirmation", "declined", "cancelled"],
  awaiting_customer: ["contacting_business", "awaiting_confirmation", "declined", "cancelled", "expired"],
  awaiting_confirmation: ["confirmed", "awaiting_customer", "contacting_business", "declined", "cancelled"],
  confirmed: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [], declined: [], cancelled: [], expired: []
});
const clean = (v) => String(v || "").trim().toLowerCase();
const slug = (value) => clean(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/** Admin may disable a location. Default is available for request intake only. */
export function assistLocationEnabled(record = {}, settings = {}) {
  if (record.assistEnabled === false || record.assistPaused === true) return false;
  if (record.status === "archived" || record.status === "removed" || record.public === false) return false;
  const country = clean(record.country || "ZW").toUpperCase();
  const city = slug(record.city);
  const policy = settings?.assistCoverage || {};
  if (policy.globalEnabled === false) return false;
  if (policy.countries?.[country]?.enabled === false) return false;
  if (policy.cities?.[`${country}:${city}`]?.enabled === false) return false;
  const area = slug(record.area || record.suburb);
  if (area && policy.areas?.[`${country}:${city}:${area}`]?.enabled === false) return false;
  return true;
}

export function assistModeForBusiness(record = {}, settings = {}) {
  if (!assistLocationEnabled(record, settings)) return null;
  if (record.commerceVerified === true || record.commerceEnabled === true || record.trustState === "commerce_verified") return null;
  if (record.assistMode === "disabled") return null;
  const type = clean(record.businessType);
  const category = clean(record.category);
  const booking = type === "appointments_services" || /salon|barber|beauty|wellness|spa|massage|fitness|professional service|photograph/.test(category);
  if (booking) return "booking";
  if (type === "restaurant_food" || type === "grocery_retail" || /restaurant|food|retail|grocer|shop|cafe|bakery/.test(category)) return "shopping";
  return null;
}

export function canAssistBook(record = {}, settings = {}) {
  return assistModeForBusiness(record, settings) === "booking" &&
    (Boolean(record.phone) || Boolean(record.website)) && Boolean(record.name) &&
    Boolean(record.city);
}

export function quoteBookingInput({ date, time, flexibility = "nearby", serviceName, alternativeWindow = "" } = {}) {
  const normalizedDate = String(date || "");
  const normalizedTime = String(time || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
    throw new Error("Choose a valid preferred date and time.");
  }
  const parsed = Date.parse(`${normalizedDate}T${normalizedTime}:00+02:00`);
  if (!Number.isFinite(parsed) || parsed < Date.now() - 60_000) throw new Error("Choose a future appointment.");
  const name = String(serviceName || "").trim();
  if (name.length < 2 || name.length > 160) throw new Error("Describe the service you need.");
  if (!["nearby", "exact"].includes(flexibility)) throw new Error("Choose whether another time is acceptable.");
  return { date: normalizedDate, time: normalizedTime, flexibility, serviceName: name, alternativeWindow: String(alternativeWindow || "").slice(0, 200) };
}
export function canTransitionAssist(current, next) {
  return current === next || ASSIST_TRANSITIONS[current]?.includes(next) === true;
}
export function assistCountryDefaults(country) {
  const code = String(country || "ZW").toUpperCase();
  const countries = {
    ZW: { countryCode: "ZW", countryName: "Zimbabwe", timezone: "Africa/Harare", displayCurrency: "USD", supportedCurrencies: ["USD", "ZWG"], phonePrefix: "+263" },
    MW: { countryCode: "MW", countryName: "Malawi", timezone: "Africa/Blantyre", displayCurrency: "MWK", supportedCurrencies: ["MWK"], phonePrefix: "+265" }
  };
  return countries[code] || { countryCode: code, countryName: code, timezone: "UTC", displayCurrency: null, supportedCurrencies: [], phonePrefix: "" };
}
