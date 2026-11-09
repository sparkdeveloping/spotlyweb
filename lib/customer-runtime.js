import { SERVICE_IDS } from "./contracts/generated.js";
import { countryCity, countryDefinition, countryForCity, normalizeCountryCode } from "./country-engine.js";
import { operationContext } from "./operations-grants.js";
import { publicProductRoute, SPOTLY_PRODUCTS } from "./spotly-products.js";
import { resolveServiceAvailability } from "./service-availability.js";

export const CUSTOMER_SERVICE_ORDER = Object.freeze(["eat", "shop", "ride", "book", "events", "send"]);

const SERVICE_SET = new Set(SERVICE_IDS);

export function normalizeCustomerRuntimeLocation({ country = "", city = "" } = {}) {
  const explicitCountry = normalizeCountryCode(country);
  const inferred = countryForCity(city);
  const countryCode = explicitCountry || inferred?.country?.code || null;
  const canonicalCity = countryCode ? countryCity(countryCode, city) : null;
  return {
    countryCode,
    country: countryDefinition(countryCode),
    city: canonicalCity?.name || "",
    cityId: canonicalCity?.id || "",
    cityValid: Boolean(canonicalCity),
    inferredCountry: !explicitCountry && Boolean(inferred)
  };
}

export function customerServiceDecision(settings = {}, { service, country = "", city = "", grants = [] } = {}) {
  const serviceId = String(service || "").trim().toLowerCase();
  const location = normalizeCustomerRuntimeLocation({ country, city });
  const base = resolveServiceAvailability(settings, { service: serviceId, country: location.countryCode, city: location.city });
  const operations = operationContext(grants, { service: serviceId, country: location.countryCode || "", city: location.city });
  const previewGranted = Boolean(operations.servicePreview || operations.serviceOperations);
  const grantBrowse = previewGranted && !base.discoverable;
  const product = SPOTLY_PRODUCTS[serviceId] || null;

  return {
    ...base,
    country: location.countryCode || base.country,
    city: location.city || base.city,
    publicVisible: base.visible,
    publicDiscoverable: base.discoverable,
    publicTransactable: base.transactable,
    visible: base.visible || grantBrowse,
    discoverable: base.discoverable || grantBrowse,
    transactable: base.transactable,
    previewGranted,
    operations,
    accessSource: grantBrowse ? "operations_grant" : base.source,
    route: publicProductRoute(serviceId),
    label: product?.nav || serviceId,
    name: product?.name || serviceId,
    indexable: base.discoverable === true,
    service: SERVICE_SET.has(serviceId) ? serviceId : base.service
  };
}

export function resolveCustomerRuntime(settings = {}, { country = "", city = "", grants = [] } = {}) {
  const location = normalizeCustomerRuntimeLocation({ country, city });
  const decisions = CUSTOMER_SERVICE_ORDER.map((service) => customerServiceDecision(settings, {
    service,
    country: location.countryCode || "",
    city: location.city,
    grants
  }));
  const services = Object.fromEntries(decisions.map((decision) => [decision.service, decision]));
  const visibleServices = decisions.filter((decision) => decision.visible).map((decision) => decision.service);
  const discoverableServices = decisions.filter((decision) => decision.discoverable).map((decision) => decision.service);
  const transactableServices = decisions.filter((decision) => decision.transactable).map((decision) => decision.service);
  return {
    ...location,
    services,
    decisions,
    visibleServices,
    discoverableServices,
    transactableServices,
    hasVisibleServices: visibleServices.length > 0,
    hasDiscoverableServices: discoverableServices.length > 0,
    revision: {
      id: settings?.serviceAvailabilityRevisionId || null,
      number: Number(settings?.serviceAvailabilityRevisionNumber || 0)
    }
  };
}

export function customerRuntimeLocationLabel(runtime = {}) {
  return runtime.city || runtime.country?.name || "Choose location";
}
