const TRANSACTIONAL_CAPABILITIES = new Set([
  "merchant_ordering", "pickup", "pickup_orders", "merchant_delivery", "delivery", "cash", "online_payment", "booking", "ticketing", "inventory", "live_inventory", "settlement"
]);

export function marketplaceTrust(record = {}) {
  const claim = String(record.ownershipStatus || record.claimStatus || "").toLowerCase();
  const verification = String(record.verificationStatus || "").toLowerCase();
  const commerceVerification = String(record.commerceVerificationStatus || "").toLowerCase();
  const status = String(record.status || "").toLowerCase();
  const lifecycle = String(record.lifecycleStatus || "").toLowerCase();
  const ownerIds = Array.isArray(record.ownerIds) ? record.ownerIds.filter(Boolean) : [];
  const pendingClaim = ["claim_pending", "claimed_pending_verification", "pending"].includes(claim);
  const claimed = !pendingClaim && (["claimed", "owner_verified"].includes(claim) || ownerIds.length > 0);
  const verified = ["approved", "verified", "spotly_verified"].includes(verification);
  // Explicit commerce verification is preferred. The legacy fallback preserves already-live,
  // owner-controlled merchants while preventing provisional/unclaimed directory imports from transacting.
  const legacyCommerce = claimed && verified && (["active", "paused"].includes(status) || ["live", "paused"].includes(lifecycle));
  const commerceVerified = record.commerceEnabled === true || record.commerceVerified === true || ["verified", "approved", "commerce_verified"].includes(commerceVerification) || legacyCommerce;
  const sourceRights = String(record.source?.rightsStatus || record.sourceRightsStatus || "").toLowerCase();
  const openListing = ["open_odbl", "spotly_created", "licensed", "merchant_owned"].includes(sourceRights);
  const listed = record.public === true && status !== "archived" && !record.canonicalBusinessId;

  let trustState = "listed";
  if (commerceVerified) trustState = "commerce_verified";
  else if (pendingClaim) trustState = "claim_pending";
  else if (verified) trustState = "verified";
  else if (claimed) trustState = "claimed";

  const configured = new Set(Array.isArray(record.capabilities) ? record.capabilities : []);
  const fulfilment = new Set(Array.isArray(record.fulfilment) ? record.fulfilment.map((item) => String(item).toLowerCase()) : []);
  const discoveryAllowed = listed && (claimed || verified || commerceVerified || openListing);
  const discovery = {
    discover: discoveryAllowed,
    save: discoveryAllowed,
    share: discoveryAllowed,
    directions: discoveryAllowed && Boolean(record.coordinates || record.latitude != null || record.longitude != null || record.address),
    contact: discoveryAllowed && Boolean(record.phone || record.email || record.website),
    claim: discoveryAllowed && !claimed,
  };
  const commerce = {
    merchantOrdering: commerceVerified && (configured.has("merchant_ordering") || configured.has("pickup_orders") || configured.has("menu") || configured.has("catalog") || record.businessType === "grocery_retail" || record.businessType === "restaurant_food"),
    pickup: commerceVerified && (fulfilment.has("pickup") || configured.has("pickup_orders") || configured.has("kiosk_pickup")),
    merchantDelivery: commerceVerified && (fulfilment.has("delivery") || fulfilment.has("merchant_delivery") || configured.has("merchant_delivery")),
    cash: commerceVerified && (record.cashEnabled === true || record.paymentMethods?.includes?.("cash")),
    onlinePayment: commerceVerified && record.onlinePaymentEnabled !== false,
    booking: commerceVerified && (configured.has("appointments") || configured.has("booking") || configured.has("bookings") || record.businessType === "appointments_services"),
    ticketing: commerceVerified && (configured.has("ticketing") || record.businessType === "ticketing_events"),
    liveInventory: commerceVerified && (configured.has("inventory") || record.inventoryEnabled === true),
    settlement: commerceVerified,
  };

  return { listed, discoveryAllowed, claimed, verified, commerceVerified, trustState, sourceRights, openListing, discovery, commerce };
}

export function safeMarketplaceCapabilities(record = {}) {
  const trust = marketplaceTrust(record);
  const original = Array.isArray(record.capabilities) ? record.capabilities : [];
  const safe = new Set(original.filter((capability) => !TRANSACTIONAL_CAPABILITIES.has(String(capability).toLowerCase())));
  if (trust.discovery.discover) safe.add("discover");
  if (trust.discovery.save) safe.add("save");
  if (trust.discovery.directions) safe.add("directions");
  if (trust.discovery.contact) safe.add("contact");
  if (trust.discovery.claim) safe.add("claim");
  if (trust.commerce.merchantOrdering) safe.add("merchant_ordering");
  if (trust.commerce.pickup) safe.add("pickup");
  if (trust.commerce.merchantDelivery) safe.add("merchant_delivery");
  if (trust.commerce.cash) safe.add("cash");
  if (trust.commerce.onlinePayment) safe.add("online_payment");
  if (trust.commerce.booking) safe.add("booking");
  if (trust.commerce.ticketing) safe.add("ticketing");
  if (trust.commerce.liveInventory) safe.add("live_inventory");
  return [...safe];
}

export function publicTrustRecord(record = {}) {
  const trust = marketplaceTrust(record);
  return {
    trustState: trust.trustState,
    ownershipStatus: trust.claimed ? "claimed" : (record.ownershipStatus || record.claimStatus || "unclaimed"),
    commerceVerified: trust.commerceVerified,
    commerceCapabilities: trust.commerce,
    discoveryCapabilities: trust.discovery,
    capabilities: safeMarketplaceCapabilities(record),
    sourceRightsStatus: trust.sourceRights || "unknown",
  };
}

export function canTransactWithBusiness(record = {}) {
  return marketplaceTrust(record).commerceVerified;
}

export function isMarketplaceDiscoverable(record = {}) {
  return marketplaceTrust(record).discoveryAllowed;
}
