import { SERVICE_IDS } from "./contracts/generated.js";
import { SPOTLY_COUNTRIES, countryCity, normalizeCountryCode } from "./country-engine.js";
import { SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION } from "./service-availability-generated.js";
import {
  normalizeServiceAvailabilityState,
  normalizeServiceId,
  resolveServiceAvailability,
  serviceAvailabilityCapabilities,
  serviceAvailabilityCityKey
} from "./service-availability.js";

const STATE_ORDER = ["hidden", "preview", "discover", "live", "paused"];
const STATE_SET = new Set(STATE_ORDER);
const SERVICE_SET = new Set(SERVICE_IDS);
const COUNTRY_SET = new Set(SPOTLY_COUNTRIES.map((country) => country.code));

export const SERVICE_AVAILABILITY_CONTROL_PLANE_VERSION = "1.0.0";
export const SERVICE_AVAILABILITY_STATE_ORDER = Object.freeze(STATE_ORDER);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cleanReason(value = "") {
  return String(value || "").trim().slice(0, 300);
}

function cleanNode(value) {
  if (typeof value === "string") {
    const state = normalizeServiceAvailabilityState(value);
    return state ? { state } : null;
  }
  if (!value || typeof value !== "object") return null;
  const state = normalizeServiceAvailabilityState(value.state);
  if (!state) return null;
  const reason = cleanReason(value.reason);
  return { state, ...(reason ? { reason } : {}) };
}

function cleanServiceNode(value = {}) {
  if (!value || typeof value !== "object") return null;
  const next = { countries: {}, cities: {} };
  const defaultState = normalizeServiceAvailabilityState(value.defaultState);
  if (defaultState) next.defaultState = defaultState;
  const reason = cleanReason(value.reason);
  if (reason) next.reason = reason;

  for (const [countryCode, node] of Object.entries(value.countries || {})) {
    const country = normalizeCountryCode(countryCode);
    const cleaned = cleanNode(node);
    if (country && COUNTRY_SET.has(country) && cleaned) next.countries[country] = cleaned;
  }

  for (const [rawKey, node] of Object.entries(value.cities || {})) {
    const [rawCountry, ...slugParts] = String(rawKey || "").split(":");
    const country = normalizeCountryCode(rawCountry);
    const slug = slugParts.join(":");
    if (!country || !COUNTRY_SET.has(country) || !slug) continue;
    const definition = SPOTLY_COUNTRIES.find((item) => item.code === country);
    const city = definition?.cities?.find((item) => item.id === slug);
    const cleaned = cleanNode(node);
    if (!city || !cleaned) continue;
    next.cities[`${country}:${city.id}`] = cleaned;
  }

  return next;
}

export function normalizeServiceAvailabilityConfig(value = {}) {
  const next = { version: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION, services: {} };
  for (const service of SERVICE_IDS) {
    const node = cleanServiceNode(value?.services?.[service]);
    if (!node) continue;
    const hasContent = node.defaultState || node.reason || Object.keys(node.countries).length || Object.keys(node.cities).length;
    if (hasContent) next.services[service] = node;
  }
  return next;
}

export function serviceAvailabilityConfigFromSettings(settings = {}) {
  return normalizeServiceAvailabilityConfig(settings.serviceAvailability || {});
}

export function materializeServiceAvailabilityRuntimeConfig(settings = {}) {
  const next = { version: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION, services: {} };
  for (const service of SERVICE_IDS) {
    const node = { countries: {}, cities: {} };
    for (const country of SPOTLY_COUNTRIES) {
      const countryDecision = resolveServiceAvailability(settings, { service, country: country.code });
      node.countries[country.code] = { state: countryDecision.state, ...(countryDecision.reason ? { reason: cleanReason(countryDecision.reason) } : {}) };
      for (const city of country.cities || []) {
        const cityDecision = resolveServiceAvailability(settings, { service, country: country.code, city: city.name });
        if (cityDecision.state === countryDecision.state && cityDecision.reason === countryDecision.reason) continue;
        const key = serviceAvailabilityCityKey(country.code, city.name);
        node.cities[key] = { state: cityDecision.state, ...(cityDecision.reason ? { reason: cleanReason(cityDecision.reason) } : {}) };
      }
    }
    next.services[service] = node;
  }
  return normalizeServiceAvailabilityConfig(next);
}

export function applyServiceAvailabilityDraftEdit(config, edit = {}) {
  const service = normalizeServiceId(edit.service);
  const scope = String(edit.scope || "").trim();
  if (!service || !["service", "country", "city"].includes(scope)) throw new Error("Choose a supported service and scope.");
  const next = normalizeServiceAvailabilityConfig(config);
  next.services[service] ||= { countries: {}, cities: {} };
  const node = next.services[service];
  node.countries ||= {};
  node.cities ||= {};
  const inherit = edit.inherit === true || edit.state === "inherit" || edit.state == null || edit.state === "";
  const state = inherit ? null : normalizeServiceAvailabilityState(edit.state);
  if (!inherit && !state) throw new Error("Choose a supported availability state.");
  const reason = cleanReason(edit.reason);

  if (scope === "service") {
    if (inherit) {
      delete node.defaultState;
      delete node.reason;
    } else {
      node.defaultState = state;
      if (reason) node.reason = reason; else delete node.reason;
    }
  } else {
    const country = normalizeCountryCode(edit.country);
    if (!country) throw new Error("Choose a supported country.");
    if (scope === "country") {
      if (inherit) delete node.countries[country];
      else node.countries[country] = { state, ...(reason ? { reason } : {}) };
    } else {
      const city = countryCity(country, edit.city);
      if (!city) throw new Error("Choose a canonical city for that country.");
      const key = serviceAvailabilityCityKey(country, city.name);
      if (inherit) delete node.cities[key];
      else node.cities[key] = { state, ...(reason ? { reason } : {}) };
    }
  }

  const empty = !node.defaultState && !node.reason && !Object.keys(node.countries || {}).length && !Object.keys(node.cities || {}).length;
  if (empty) delete next.services[service];
  return normalizeServiceAvailabilityConfig(next);
}

function settingsFor(config) {
  return { serviceAvailability: normalizeServiceAvailabilityConfig(config) };
}

function decision(config, service, country, city = "") {
  return resolveServiceAvailability(settingsFor(config), { service, country, city });
}

function directNode(config, service, scope, country = "", city = "") {
  const node = normalizeServiceAvailabilityConfig(config).services?.[service] || {};
  if (scope === "service") return node.defaultState ? { state: node.defaultState, reason: node.reason || "" } : null;
  if (scope === "country") return node.countries?.[country] || null;
  const key = serviceAvailabilityCityKey(country, city);
  return key ? node.cities?.[key] || null : null;
}

function equivalentNode(a, b) {
  return String(a?.state || "") === String(b?.state || "") && String(a?.reason || "") === String(b?.reason || "");
}

function riskFor(before, after) {
  if (before.transactable && !after.transactable) return { level: "critical", label: "Stops new transactions" };
  if (!before.transactable && after.transactable) return { level: "high", label: "Starts new transactions" };
  if (before.visible && !after.visible) return { level: "high", label: "Hides customer surface" };
  if (!before.visible && after.visible) return { level: "medium", label: "Shows customer surface" };
  if (before.discoverable && !after.discoverable) return { level: "medium", label: "Stops discovery" };
  if (!before.discoverable && after.discoverable) return { level: "low", label: "Enables discovery" };
  return { level: "low", label: "Presentation/configuration change" };
}

function runtimeChange(before, after, context) {
  const changed = before.state !== after.state || before.reason !== after.reason || before.source !== after.source;
  if (!changed) return null;
  return {
    ...context,
    before: { state: before.state, reason: before.reason, source: before.source, ...serviceAvailabilityCapabilities(before.state) },
    after: { state: after.state, reason: after.reason, source: after.source, ...serviceAvailabilityCapabilities(after.state) },
    risk: riskFor(before, after)
  };
}

export function serviceAvailabilityImpact(activeConfig = {}, draftConfig = {}) {
  const active = normalizeServiceAvailabilityConfig(activeConfig);
  const draft = normalizeServiceAvailabilityConfig(draftConfig);
  const directChanges = [];
  const runtimeChanges = [];

  for (const service of SERVICE_IDS) {
    const beforeService = directNode(active, service, "service");
    const afterService = directNode(draft, service, "service");
    if (!equivalentNode(beforeService, afterService)) directChanges.push({ service, scope: "service", before: beforeService, after: afterService });
    for (const country of SPOTLY_COUNTRIES) {
      const beforeCountryNode = directNode(active, service, "country", country.code);
      const afterCountryNode = directNode(draft, service, "country", country.code);
      if (!equivalentNode(beforeCountryNode, afterCountryNode)) directChanges.push({ service, scope: "country", country: country.code, before: beforeCountryNode, after: afterCountryNode });

      const beforeCountry = decision(active, service, country.code);
      const afterCountry = decision(draft, service, country.code);
      const countryChange = runtimeChange(beforeCountry, afterCountry, { service, scope: "country", country: country.code, countryName: country.name, city: "" });
      if (countryChange) runtimeChanges.push(countryChange);

      for (const city of country.cities || []) {
        const beforeCityNode = directNode(active, service, "city", country.code, city.name);
        const afterCityNode = directNode(draft, service, "city", country.code, city.name);
        if (!equivalentNode(beforeCityNode, afterCityNode)) directChanges.push({ service, scope: "city", country: country.code, city: city.name, before: beforeCityNode, after: afterCityNode });
        const beforeCity = decision(active, service, country.code, city.name);
        const afterCity = decision(draft, service, country.code, city.name);
        const cityChange = runtimeChange(beforeCity, afterCity, { service, scope: "city", country: country.code, countryName: country.name, city: city.name });
        if (cityChange) runtimeChanges.push(cityChange);
      }
    }
  }

  const uniqueServices = [...new Set(runtimeChanges.map((item) => item.service))];
  const uniqueCountries = [...new Set(runtimeChanges.map((item) => item.country))];
  const summary = {
    directChanges: directChanges.length,
    runtimeContexts: runtimeChanges.length,
    countryContexts: runtimeChanges.filter((item) => item.scope === "country").length,
    cityContexts: runtimeChanges.filter((item) => item.scope === "city").length,
    servicesAffected: uniqueServices.length,
    countriesAffected: uniqueCountries.length,
    transactionsStarting: runtimeChanges.filter((item) => !item.before.transactable && item.after.transactable).length,
    transactionsStopping: runtimeChanges.filter((item) => item.before.transactable && !item.after.transactable).length,
    surfacesHidden: runtimeChanges.filter((item) => item.before.visible && !item.after.visible).length,
    surfacesShown: runtimeChanges.filter((item) => !item.before.visible && item.after.visible).length,
    critical: runtimeChanges.filter((item) => item.risk.level === "critical").length,
    high: runtimeChanges.filter((item) => item.risk.level === "high").length
  };
  return { changed: directChanges.length > 0, directChanges, runtimeChanges, summary, services: uniqueServices, countries: uniqueCountries };
}

function readinessCheck(id, label, state, detail, blocking = false) {
  return { id, label, state, detail, blocking: blocking && state === "blocked" };
}

function marketplaceFacts(facts, service, country, city = "") {
  const serviceFacts = facts?.marketplace?.[service]?.[country] || {};
  if (!city) return serviceFacts;
  return serviceFacts.cities?.[String(city).toLowerCase()] || {};
}

function driverFacts(facts, service, country, city = "") {
  const serviceFacts = facts?.drivers?.[service]?.[country] || {};
  if (!city) return serviceFacts;
  return serviceFacts.cities?.[String(city).toLowerCase()] || {};
}

export function serviceReadinessForContext({ service, country, city = "", state, facts = {} } = {}) {
  const serviceId = normalizeServiceId(service);
  const countryCode = normalizeCountryCode(country);
  const targetState = normalizeServiceAvailabilityState(state) || "hidden";
  if (!serviceId || !countryCode) return { state: "blocked", checks: [readinessCheck("canonical", "Canonical scope", "blocked", "Unsupported service or country.", true)], blockers: 1 };
  const live = targetState === "live";
  const checks = [];
  checks.push(readinessCheck("country", "Country configuration", "ready", `${countryCode} is in the canonical Spotly country catalog.`));

  const supportReady = facts.supportConfigured === true;
  checks.push(readinessCheck("support", "Customer support", supportReady ? "ready" : "warning", supportReady ? "Public support hours and at least one contact channel are configured." : "Support coverage is incomplete; publishing remains possible, but launch operations should resolve this."));

  if (["eat", "shop", "book", "events"].includes(serviceId)) {
    const supply = marketplaceFacts(facts, serviceId, countryCode, city);
    const transactional = Number(supply.transactional || 0);
    const discoverable = Number(supply.discoverable || 0);
    const supplyState = transactional > 0 ? "ready" : live ? "blocked" : discoverable > 0 ? "warning" : "warning";
    checks.push(readinessCheck(
      "supply",
      "Live marketplace supply",
      supplyState,
      transactional > 0
        ? `${transactional} commerce-ready ${serviceId} location${transactional === 1 ? "" : "s"}${city ? ` in ${city}` : ` in ${countryCode}`}.`
        : discoverable > 0
          ? `${discoverable} discoverable location${discoverable === 1 ? "" : "s"}, but none are commerce-ready for a live launch.`
          : `No ${serviceId} supply is currently available in this scope.`,
      live
    ));
  }

  if (["ride", "send"].includes(serviceId)) {
    const infra = facts?.mobility?.[serviceId] || {};
    const enabledCountries = Array.isArray(infra.enabledCountries) ? infra.enabledCountries.map((value) => String(value).toUpperCase()) : [];
    const territoryReady = enabledCountries.includes(countryCode);
    checks.push(readinessCheck(
      "territory",
      "Backend territory support",
      territoryReady ? "ready" : live ? "blocked" : "warning",
      territoryReady
        ? `${serviceId === "send" ? "Send" : "Ride"} is explicitly enabled for ${countryCode} in the mobility backend.`
        : `${serviceId === "send" ? "Send" : "Ride"} has not been enabled for ${countryCode} in mobility configuration.`,
      live
    ));
    const countryInfra = infra.countries?.[countryCode] || {};
    checks.push(readinessCheck(
      "pricing",
      "Country pricing",
      countryInfra.pricingReady ? "ready" : live ? "blocked" : "warning",
      countryInfra.pricingReady
        ? `${serviceId === "send" ? "Send" : "Ride"} has approved ${countryInfra.currency || "country"} pricing for ${countryCode}.`
        : `${serviceId === "send" ? "Send" : "Ride"} does not have an approved pricing profile for ${countryCode}.`,
      live
    ));
    checks.push(readinessCheck(
      "payments",
      "Country payment path",
      countryInfra.paymentReady ? "ready" : live ? "blocked" : "warning",
      countryInfra.paymentReady
        ? `${(countryInfra.paymentMethods || []).join(" + ")} is available for ${countryCode}.`
        : `No production payment method is available for ${serviceId} in ${countryCode}.`,
      live
    ));
    checks.push(readinessCheck("routing", "Road routing & geocoding", infra.routingReady ? "ready" : live ? "blocked" : "warning", infra.routingReady ? "Verified routing and geocoding are configured." : "Verified routing/geocoding is not ready.", live));
    checks.push(readinessCheck("scheduler", "Dispatch scheduler", infra.schedulerReady ? "ready" : live ? "blocked" : "warning", infra.schedulerReady ? "Authenticated recurring dispatch is verified." : "Recurring dispatch scheduler verification is incomplete.", live));
    checks.push(readinessCheck("pin", "Handoff/PIN encryption", infra.pinReady ? "ready" : live ? "blocked" : "warning", infra.pinReady ? "A dedicated production PIN encryption key is configured." : "The service-specific PIN encryption key is missing or too short.", live));

    if (city) {
      const key = serviceAvailabilityCityKey(countryCode, city);
      const geofenceReady = Boolean(key && infra.geofences?.[key]);
      checks.push(readinessCheck("geofence", "Service geofence", geofenceReady ? "ready" : live ? "blocked" : "warning", geofenceReady ? `${city} has an approved ${serviceId} service geofence.` : `${city} does not have an approved ${serviceId} service geofence.`, live));
    }

    const drivers = driverFacts(facts, serviceId, countryCode, city);
    const active = Number(drivers.active || 0);
    checks.push(readinessCheck("drivers", "Driver supply", active > 0 ? "ready" : live ? "blocked" : "warning", active > 0 ? `${active} approved Driver${active === 1 ? "" : "s"} can perform ${serviceId}${city ? ` in ${city}` : ` in ${countryCode}`}.` : `No approved ${serviceId} Driver supply is recorded in this scope.`, live));
  }

  const blockers = checks.filter((item) => item.blocking).length;
  const stateValue = blockers ? "blocked" : checks.some((item) => item.state === "warning") ? "warning" : "ready";
  return { state: stateValue, checks, blockers };
}

export function buildServiceAvailabilityReadiness(config = {}, facts = {}) {
  const normalized = normalizeServiceAvailabilityConfig(config);
  const settings = settingsFor(normalized);
  const countries = {};
  const publishBlockers = [];

  for (const country of SPOTLY_COUNTRIES) {
    const countryEntry = { code: country.code, name: country.name, services: {}, cities: {} };
    for (const service of SERVICE_IDS) {
      const current = resolveServiceAvailability(settings, { service, country: country.code });
      const readiness = serviceReadinessForContext({ service, country: country.code, state: current.state, facts });
      countryEntry.services[service] = { decision: current, readiness };
      if (current.state === "live" && readiness.blockers) publishBlockers.push({ service, country: country.code, city: "", blockers: readiness.checks.filter((item) => item.blocking) });
    }
    for (const city of country.cities || []) {
      const cityEntry = { id: city.id, name: city.name, services: {} };
      for (const service of SERVICE_IDS) {
        const current = resolveServiceAvailability(settings, { service, country: country.code, city: city.name });
        const readiness = serviceReadinessForContext({ service, country: country.code, city: city.name, state: current.state, facts });
        cityEntry.services[service] = { decision: current, readiness };
        if (current.state === "live" && readiness.blockers) publishBlockers.push({ service, country: country.code, city: city.name, blockers: readiness.checks.filter((item) => item.blocking) });
      }
      countryEntry.cities[city.id] = cityEntry;
    }
    countries[country.code] = countryEntry;
  }

  return { countries, publishBlockers, blockerCount: publishBlockers.length };
}

export function publishBlockersForImpact(readiness, impact) {
  if (!readiness || !impact?.runtimeChanges?.length) return [];
  const changedLiveKeys = new Set(impact.runtimeChanges.filter((item) => item.after.state === "live").map((item) => `${item.service}|${item.country}|${item.city || ""}`));
  return (readiness.publishBlockers || []).filter((item) => changedLiveKeys.has(`${item.service}|${item.country}|${item.city || ""}`));
}

export function serviceAvailabilityMatrix(config = {}) {
  const normalized = normalizeServiceAvailabilityConfig(config);
  const settings = settingsFor(normalized);
  return SPOTLY_COUNTRIES.map((country) => ({
    country: country.code,
    name: country.name,
    services: Object.fromEntries(SERVICE_IDS.map((service) => [service, {
      decision: resolveServiceAvailability(settings, { service, country: country.code }),
      override: directNode(normalized, service, "country", country.code)
    }])),
    cities: (country.cities || []).map((city) => ({
      id: city.id,
      name: city.name,
      services: Object.fromEntries(SERVICE_IDS.map((service) => [service, {
        decision: resolveServiceAvailability(settings, { service, country: country.code, city: city.name }),
        override: directNode(normalized, service, "city", country.code, city.name)
      }]))
    }))
  }));
}

export function serviceAvailabilityConfigEqual(a, b) {
  return JSON.stringify(normalizeServiceAvailabilityConfig(a)) === JSON.stringify(normalizeServiceAvailabilityConfig(b));
}

export function serviceAvailabilityRevisionLabel(number) {
  const value = Number(number || 0);
  return value > 0 ? `Revision ${value}` : "Bootstrap configuration";
}

export function validServiceAvailabilityState(value) {
  return STATE_SET.has(String(value || ""));
}

export function validServiceAvailabilityService(value) {
  return SERVICE_SET.has(String(value || ""));
}
