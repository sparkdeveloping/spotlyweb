// A single read-only interpretation layer for the Admin business register.
// Never convert directory publication into merchant/transaction approval.
export function adminBusinessState(b = {}) {
  const claimed = b.claimStatus === "claimed" || (b.ownerIds?.length || 0) > 0;
  const pendingClaim = ["claim_pending", "claim_needs_information"].includes(b.claimStatus) ||
    ["claim_pending", "claim_needs_information"].includes(b.status);
  const verified = b.verificationStatus === "approved";
  const review = b.launchReview?.status || b.launchReview?.state || b.reviewStatus || "";
  const launchPending = ["submitted", "under_review", "pending", "pending_review", "changes_requested"].includes(review) ||
    ["pending_publication_review", "pending_launch_review"].includes(b.status);
  const suspended = b.lifecycleStatus === "suspended" || b.status === "suspended" || Boolean(b.suspension?.active);
  const published = b.public === true;
  const merchantLive = !suspended && verified && claimed &&
    (b.lifecycleStatus === "live" || b.status === "active") && published;
  const assist = Boolean(b.assistStoreId || b.assistEnabled || b.source?.type === "independent_assist");
  let attention = "none", next = "Review listing details";
  if (suspended) { attention = "suspended"; next = "Review suspension before resuming"; }
  else if (pendingClaim) { attention = "ownership"; next = "Review ownership claim and submitted evidence"; }
  else if (launchPending) { attention = "launch"; next = "Review location, documentation and launch submission"; }
  else if (claimed && !verified) { attention = "identity"; next = "Review verification evidence"; }
  else if (!claimed && !assist) { attention = "unclaimed"; next = "Invite business owner or keep as directory discovery"; }
  else if (assist && !merchantLive) { attention = "assist"; next = "Independent shopping is separate from merchant approval"; }
  else if (merchantLive) { attention = "live"; next = "Monitor active merchant operations"; }
  return {
    ownership: pendingClaim ? "claim_pending" : claimed ? "claimed" : "unclaimed",
    verification: verified ? "approved" : b.verificationStatus || "unverified",
    publication: suspended ? "suspended" : published ? "visible" : "hidden",
    commerce: merchantLive ? "merchant_live" : assist ? "independent_assist" : "not_enabled",
    attention, next, claimed, verified, merchantLive, assist
  };
}
export function adminDateMs(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  if (value?._seconds) return value._seconds * 1000;
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}
export function adminBusinessMatches(b, f = {}) {
  const state = adminBusinessState(b);
  const term = String(f.q || "").trim().toLowerCase();
  const text = [b.name,b.brandName,b.legalName,b.id,b.category,b.city,b.email,
    b.organizationId,b.createdBy,b.source?.type,b.source?.createdBy,
    ...(b.ownerIds || [])].filter(Boolean).join(" ").toLowerCase();
  if (term && !text.includes(term)) return false;
  if (f.city && String(b.city || "").toLowerCase() !== f.city.toLowerCase()) return false;
  if (f.source && String(b.source?.type || "unknown") !== f.source) return false;
  if (f.ownership && state.ownership !== f.ownership) return false;
  if (f.verification && state.verification !== f.verification) return false;
  if (f.publication && state.publication !== f.publication) return false;
  if (f.commerce && state.commerce !== f.commerce) return false;
  if (f.attention && state.attention !== f.attention) return false;
  const created = adminDateMs(b.createdAt);
  if (f.from && (!created || created < Date.parse(f.from + "T00:00:00.000Z"))) return false;
  if (f.to && (!created || created >= Date.parse(f.to + "T00:00:00.000Z") + 86400000)) return false;
  return true;
}
export function adminSafeBusiness(id, b = {}) {
  return {
    id, name:b.name || "Unnamed business", brandName:b.brandName || "", category:b.category || "",
    city:b.city || "", country:b.country || "", status:b.status || "unknown",
    verificationStatus:b.verificationStatus || "unverified", claimStatus:b.claimStatus || "unclaimed",
    lifecycleStatus:b.lifecycleStatus || "", onboardingStatus:b.onboardingStatus || "",
    public:b.public === true, branchCount:b.branchCount || b.branchIds?.length || 0,
    organizationId:b.organizationId || "", ownerIds:Array.isArray(b.ownerIds) ? b.ownerIds.slice(0,15) : [],
    createdBy:b.createdBy || b.source?.createdBy || "",
    sourceType:b.source?.type || "unknown", source:b.source?.type || "unknown",
    createdAt:adminDateMs(b.createdAt) ? new Date(adminDateMs(b.createdAt)).toISOString() : null,
    updatedAt:adminDateMs(b.updatedAt) ? new Date(adminDateMs(b.updatedAt)).toISOString() : null,
    assistStoreId:b.assistStoreId || null,
    readiness:adminBusinessState(b)
  };
}
