import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";

function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function pick(source, keys) { const value = record(source); return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]])); }

// Only customer-facing runtime configuration belongs here. Operational policy,
// verification thresholds, security controls, provider configuration and finance
// internals stay behind authenticated Admin/server APIs.
export function publicPlatformSettings(settings = {}) {
  const source = record(settings);
  const launch = pick(source.launch, [
    "publicMode", "countdownVisible", "countdownTarget", "marketplaceEnabled",
    "businessClaimsEnabled", "businessApplicationsEnabled", "businessLaunchReviewEnabled",
    "businessLaunchEnabled", "supportedCountries", "primaryCity", "primaryCategory",
    "pilotStatus", "invitationStatus", "businessParticipationStatus", "pickupAvailabilityMessage",
    "supportedAreas", "launchCities", "timezone", "languages", "defaultLanguage",
    "waitlistEnabled", "partnershipFormEnabled", "featuredBusinessIds", "homepageFeaturedLimit"
  ]);
  const commerce = pick(source.commerce, [
    "enabled", "deliveryEnabled", "fulfilment", "marketplaceCategories", "currencies",
    "defaultCurrency", "paymentMethods", "pickupSlotMinutes", "defaultSlotCapacity",
    "substitutionsEnabled", "cancellationWindowMinutes", "taxInclusivePricing"
  ]);
  const support = pick(source.support, [
    "liveChatEnabled", "audience", "email", "phone", "whatsapp", "hours", "timezone",
    "responseTargetMinutes", "publicChatGreeting"
  ]);
  const legal = pick(source.legal, [
    "legalName", "tradingName", "companyNumber", "privacyEmail", "termsEmail",
    "privacyPolicyUrl", "termsUrl", "merchantAgreementUrl", "refundPolicyUrl",
    "acceptableUseUrl", "dataProcessingUrl"
  ]);
  const branding = pick(source.branding, [
    "productName", "businessPortalName", "tagline", "publicTheme", "primaryColor"
  ]);

  return {
    serviceAvailability: source.serviceAvailability || DEFAULT_PLATFORM_SETTINGS.serviceAvailability,
    serviceAvailabilityRevisionId: source.serviceAvailabilityRevisionId || null,
    serviceAvailabilityRevisionNumber: Number(source.serviceAvailabilityRevisionNumber || 0),
    launch,
    commerce,
    support,
    legal,
    branding
  };
}
