import { SERVICE_IDS } from "./contracts/generated.js";
import { countryCity, normalizeCountryCode } from "./country-engine.js";
import { SERVICE_AVAILABILITY_BOOTSTRAP, SERVICE_AVAILABILITY_STATES } from "./service-availability-generated.js";

const SERVICE_SET = new Set(SERVICE_IDS);
const STATE_SET = new Set(Object.keys(SERVICE_AVAILABILITY_STATES));
const BOOTSTRAP = new Map(SERVICE_AVAILABILITY_BOOTSTRAP.map((entry) => [entry.id, entry]));

export function normalizeServiceId(value) {
  const id = String(value || "").trim().toLowerCase();
  return SERVICE_SET.has(id) ? id : null;
}

export function normalizeServiceAvailabilityState(value) {
  const state = String(value || "").trim().toLowerCase();
  return STATE_SET.has(state) ? state : null;
}

export function serviceAvailabilityCapabilities(state) {
  const normalized = normalizeServiceAvailabilityState(state) || "hidden";
  return { ...SERVICE_AVAILABILITY_STATES[normalized], state: normalized };
}

export function serviceAvailabilityCityKey(countryCode, city) {
  const country = normalizeCountryCode(countryCode);
  if (!country) return null;
  const canonical = countryCity(country, city);
  const slug = canonical?.id || String(city || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `${country}:${slug}` : null;
}

function bootstrapState(service, country) {
  const entry = BOOTSTRAP.get(service);
  if (!entry) return "hidden";
  return normalizeServiceAvailabilityState(entry.countries?.[country]) || normalizeServiceAvailabilityState(entry.defaultState) || "hidden";
}

function stateFromNode(node) {
  if (typeof node === "string") return normalizeServiceAvailabilityState(node);
  if (node && typeof node === "object") return normalizeServiceAvailabilityState(node.state);
  return null;
}

function explicitDecision(settings, service, country, cityKey) {
  const root = settings?.serviceAvailability;
  const node = root?.services?.[service];
  if (!node || typeof node !== "object") return null;
  const cityState = cityKey ? stateFromNode(node.cities?.[cityKey]) : null;
  if (cityState) return { state: cityState, source: "city", reason: String(node.cities?.[cityKey]?.reason || "") };
  const countryState = stateFromNode(node.countries?.[country]);
  if (countryState) return { state: countryState, source: "country", reason: String(node.countries?.[country]?.reason || "") };
  const defaultState = stateFromNode(node.defaultState || node);
  if (defaultState) return { state: defaultState, source: "service", reason: String(node.reason || "") };
  return null;
}

function legacyDecision(settings, service, country, cityKey) {
  const launch = settings?.launch || {};
  const mobility = settings?.mobility || {};
  if (["eat", "shop", "book", "events"].includes(service)) {
    if (launch.marketplaceEnabled === false) return { state: "preview", source: "legacy", reason: "Marketplace launch is paused." };
    return null;
  }
  if (service === "ride" && mobility.ridesEnabled === true) {
    const countries = Array.isArray(mobility.enabledCountries) ? mobility.enabledCountries.map((value) => String(value).toUpperCase()) : [];
    const cities = Array.isArray(mobility.enabledCities) ? mobility.enabledCities : [];
    if (countries.includes(country) && cityKey && cities.some((city) => serviceAvailabilityCityKey(country, city) === cityKey)) return { state: "live", source: "legacy", reason: "" };
    if (countries.includes(country)) return { state: "discover", source: "legacy", reason: "Ride is not accepting requests in this city yet." };
  }
  if (service === "send" && mobility.send?.enabled === true && country === "ZW") {
    const cities = Array.isArray(mobility.send.enabledCities) ? mobility.send.enabledCities : [];
    if (cityKey && cities.some((city) => serviceAvailabilityCityKey(country, city) === cityKey)) return { state: "live", source: "legacy", reason: "" };
    return { state: "discover", source: "legacy", reason: "Send is not accepting requests in this city yet." };
  }
  return null;
}

export function resolveServiceAvailability(settings = {}, { service, country, city = "" } = {}) {
  const serviceId = normalizeServiceId(service);
  const countryCode = normalizeCountryCode(country);
  if (!serviceId || !countryCode) {
    const flags = serviceAvailabilityCapabilities("hidden");
    return { service: serviceId || String(service || ""), country: countryCode || String(country || "").toUpperCase(), city: String(city || ""), state: "hidden", source: "invalid", reason: "Choose a supported service and country.", ...flags };
  }
  const canonicalCity = countryCity(countryCode, city);
  const cityName = canonicalCity?.name || String(city || "").trim();
  const cityKey = serviceAvailabilityCityKey(countryCode, cityName);
  const explicit = explicitDecision(settings, serviceId, countryCode, cityKey);
  const revisionOwned = Number(settings?.serviceAvailabilityRevisionNumber || 0) > 0;
  const legacy = explicit || revisionOwned ? null : legacyDecision(settings, serviceId, countryCode, cityKey);
  const chosen = explicit || legacy || { state: bootstrapState(serviceId, countryCode), source: "bootstrap", reason: "" };
  const flags = serviceAvailabilityCapabilities(chosen.state);
  return { service: serviceId, country: countryCode, city: cityName, cityKey, state: flags.state, source: chosen.source, reason: chosen.reason || "", visible: flags.visible, discoverable: flags.discoverable, transactable: flags.transactable, paused: flags.paused };
}

export function resolveServiceAvailabilitySet(settings = {}, { country, city = "" } = {}) {
  return SERVICE_IDS.map((service) => resolveServiceAvailability(settings, { service, country, city }));
}

export function serviceUnavailableMessage(decision, action = "use") {
  if (!decision) return "This Spotly service is unavailable.";
  if (decision.reason) return decision.reason;
  if (decision.state === "hidden") return "This Spotly service is not available in this area.";
  if (decision.state === "preview") return "This Spotly service is coming soon in this area.";
  if (decision.state === "discover") return action === "discover" ? "" : "You can explore this service here, but new requests are not open yet.";
  if (decision.state === "paused") return "This Spotly service is temporarily paused for new requests in this area.";
  return "This Spotly service is unavailable right now.";
}
