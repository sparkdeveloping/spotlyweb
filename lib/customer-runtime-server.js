import "server-only";

import { getAdminServices } from "@/lib/firebase-admin";
import { SPOTLY_COUNTRIES, countryCity, countryDefinition, countryForCity, normalizeCountryCode } from "@/lib/country-engine";
import { CUSTOMER_SERVICE_ORDER, customerServiceDecision, resolveCustomerRuntime } from "@/lib/customer-runtime";
import { SPOTLY_PRODUCTS } from "@/lib/spotly-products";

const MARKETPLACE_CITY_SERVICES = new Set(["eat", "shop", "book", "events"]);

export async function getPublishedCustomerSettings() {
  try {
    const { db } = getAdminServices();
    const snapshot = await db.collection("platformSettings").doc("global").get();
    return snapshot.exists ? snapshot.data() || {} : {};
  } catch {
    return {};
  }
}

export async function getPublishedCustomerRuntime(scope = {}) {
  const settings = await getPublishedCustomerSettings();
  return resolveCustomerRuntime(settings, { country: scope.country || "", city: scope.city || "", grants: [] });
}

export async function getPublicServiceSeo(service, scope = {}) {
  const settings = await getPublishedCustomerSettings();
  const countryCode = normalizeCountryCode(scope.country) || countryForCity(scope.city)?.country?.code || "";
  if (countryCode || scope.city) {
    const decision = customerServiceDecision(settings, { service, country: countryCode, city: scope.city || "", grants: [] });
    return { ...decision, countryDefinition: countryDefinition(decision.country) };
  }

  const decisions = [];
  for (const country of SPOTLY_COUNTRIES) {
    decisions.push(customerServiceDecision(settings, { service, country: country.code, city: "", grants: [] }));
    for (const city of country.cities) decisions.push(customerServiceDecision(settings, { service, country: country.code, city: city.name, grants: [] }));
  }
  return {
    service,
    visible: decisions.some((decision) => decision.visible),
    discoverable: decisions.some((decision) => decision.discoverable),
    transactable: decisions.some((decision) => decision.transactable),
    indexable: decisions.some((decision) => decision.publicDiscoverable === true),
    states: [...new Set(decisions.map((decision) => decision.state))]
  };
}

export async function getPublicCustomerSitemapRoutes(publishedSettings = null) {
  const settings = publishedSettings || await getPublishedCustomerSettings();
  const serviceRoutes = CUSTOMER_SERVICE_ORDER.map((service) => {
    const decisions = SPOTLY_COUNTRIES.flatMap((country) => [
      customerServiceDecision(settings, { service, country: country.code, city: "", grants: [] }),
      ...country.cities.map((city) => customerServiceDecision(settings, { service, country: country.code, city: city.name, grants: [] }))
    ]);
    const indexable = decisions.some((decision) => decision.publicDiscoverable === true);
    return indexable ? { service, path: SPOTLY_PRODUCTS[service]?.route || `/${service}` } : null;
  }).filter(Boolean);

  const cityRoutes = [];
  for (const country of SPOTLY_COUNTRIES) {
    for (const city of country.cities) {
      for (const service of MARKETPLACE_CITY_SERVICES) {
        const decision = customerServiceDecision(settings, { service, country: country.code, city: city.name, grants: [] });
        if (!decision.publicDiscoverable) continue;
        cityRoutes.push({
          country: country.code,
          countryName: country.name,
          city: city.name,
          citySlug: city.id,
          service,
          serviceSlug: String(SPOTLY_PRODUCTS[service]?.route || `/${service}`).replace(/^\//, "")
        });
      }
    }
  }
  return { serviceRoutes, cityRoutes };
}

export function resolveCanonicalCityRoute(citySlug, serviceSlug) {
  const cityResult = countryForCity(citySlug);
  if (!cityResult) return null;
  const service = Object.values(SPOTLY_PRODUCTS).find((product) => {
    const canonical = product.route.replace(/^\//, "");
    const legacy = product.legacy?.replace(/^\//, "");
    return canonical === String(serviceSlug || "").toLowerCase() || legacy === String(serviceSlug || "").toLowerCase() || product.id === String(serviceSlug || "").toLowerCase();
  })?.id;
  if (!service || !MARKETPLACE_CITY_SERVICES.has(service)) return null;
  const city = countryCity(cityResult.country.code, cityResult.city.id);
  const product = SPOTLY_PRODUCTS[service];
  return {
    country: cityResult.country,
    city,
    service,
    product,
    citySlug: city.id,
    serviceSlug: product.route.replace(/^\//, "")
  };
}
