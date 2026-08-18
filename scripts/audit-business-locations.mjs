import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const applyLinks = process.argv.includes("--apply-links");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin environment variables. Load the production environment before running this audit.");
  process.exit(1);
}

const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
const db = getFirestore(app);

function uniq(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}
function norm(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function signature(branch) {
  return [branch.businessId || "unlinked", norm(branch.branchName || branch.name), norm(branch.city), norm(branch.address)].join("|");
}
function sameOrganization(branch = {}, business = {}) {
  return Boolean(branch.organizationId && business.organizationId && String(branch.organizationId) === String(business.organizationId));
}

const [businessSnapshot, branchSnapshot, reviewSnapshot, launchReviewSnapshot, claimSnapshot] = await Promise.all([
  db.collection("businesses").get(),
  db.collection("branches").get(),
  db.collection("businessLocationReviews").get().catch(() => ({ docs: [] })),
  db.collection("businessLaunchReviews").get().catch(() => ({ docs: [] })),
  db.collection("businessClaims").get().catch(() => ({ docs: [] }))
]);

const businesses = new Map(businessSnapshot.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
const branches = branchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const branchById = new Map(branches.map((branch) => [branch.id, branch]));
const directByBusiness = new Map();
for (const branch of branches) {
  if (!directByBusiness.has(branch.businessId || "")) directByBusiness.set(branch.businessId || "", []);
  directByBusiness.get(branch.businessId || "").push(branch);
}

const reviewIdsByBusiness = new Map();
function addEvidence(businessId, branchIds = []) {
  if (!businessId) return;
  if (!reviewIdsByBusiness.has(businessId)) reviewIdsByBusiness.set(businessId, []);
  reviewIdsByBusiness.get(businessId).push(...uniq(branchIds));
}
for (const doc of reviewSnapshot.docs || []) {
  const review = doc.data() || {};
  addEvidence(review.businessId, [review.branchId]);
}
for (const doc of launchReviewSnapshot.docs || []) {
  const review = doc.data() || {};
  addEvidence(review.businessId, [review.branchId, ...(Array.isArray(review.branchIdsSnapshot) ? review.branchIdsSnapshot : []), ...(Array.isArray(review.branchIds) ? review.branchIds : [])]);
}
for (const doc of claimSnapshot.docs || []) {
  const claim = doc.data() || {};
  addEvidence(claim.businessId, [claim.branchId, ...(Array.isArray(claim.branchIds) ? claim.branchIds : [])]);
}

const problems = [];
const safeBranchRepairs = [];
const unsafeMismatches = [];
const missingBranchDocuments = [];
const canonicalByBusiness = new Map();

for (const business of businesses.values()) {
  const directIds = (directByBusiness.get(business.id) || []).map((branch) => branch.id);
  const storedIds = uniq([
    ...(Array.isArray(business.branchIds) ? business.branchIds : []),
    business.primaryBranchId,
    business.primaryLocationId,
    business.defaultBranchId
  ]);
  const reviewIds = uniq(reviewIdsByBusiness.get(business.id) || []);
  const candidateIds = uniq([...directIds, ...storedIds, ...reviewIds]);
  const canonical = [];

  for (const branchId of candidateIds) {
    const branch = branchById.get(branchId);
    if (!branch) {
      missingBranchDocuments.push({ businessId: business.id, branchId, evidence: reviewIds.includes(branchId) ? "review" : "business_link" });
      continue;
    }
    if (branch.businessId === business.id) {
      canonical.push(branch);
      continue;
    }

    const reviewEvidence = reviewIds.includes(branchId);
    const businessLinkEvidence = storedIds.includes(branchId);
    const orgEvidence = sameOrganization(branch, business);
    const linkedToOtherBusiness = [...businesses.values()].some((other) => other.id !== business.id && Array.isArray(other.branchIds) && other.branchIds.includes(branchId));
    const canRepair = !branch.businessId && !linkedToOtherBusiness && (businessLinkEvidence || reviewEvidence || orgEvidence);
    if (canRepair) {
      canonical.push(branch);
      safeBranchRepairs.push({ businessId: business.id, branchId, reason: businessLinkEvidence ? "business_link_evidence" : reviewEvidence ? "review_or_claim_evidence" : "organization_match" });
      if (applyLinks) {
        await db.collection("branches").doc(branchId).set({
          businessId: business.id,
          organizationId: business.organizationId || branch.organizationId || null,
          locationIntegrityRepairedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } else {
      unsafeMismatches.push({ businessId: business.id, branchId, branchBusinessId: branch.businessId || null, branchOrganizationId: branch.organizationId || null, businessLinkEvidence, reviewEvidence, orgEvidence, linkedToOtherBusiness });
    }
  }

  const canonicalIds = uniq(canonical.map((branch) => branch.id)).sort();
  canonicalByBusiness.set(business.id, canonicalIds);
  const storedBranchIds = uniq(Array.isArray(business.branchIds) ? business.branchIds : []).sort();
  const primary = business.primaryBranchId || business.primaryLocationId || business.defaultBranchId || "";
  const canonicalPrimary = canonicalIds.includes(primary) ? primary : (canonicalIds[0] || "");
  const missingLinks = canonicalIds.filter((id) => !storedBranchIds.includes(id));
  const staleLinks = storedBranchIds.filter((id) => !canonicalIds.includes(id));
  const countMismatch = Number(business.branchCount || 0) !== canonicalIds.length;
  const primaryMismatch = Boolean(canonicalPrimary && canonicalPrimary !== primary);
  const incomplete = canonical.filter((branch) => !(branch.branchName || branch.name) || !branch.city);

  if (missingLinks.length || staleLinks.length || countMismatch || primaryMismatch || incomplete.length || reviewIds.some((id) => !directIds.includes(id))) {
    problems.push({
      businessId: business.id,
      name: business.brandName || business.name || "Business",
      directCount: directIds.length,
      canonicalCount: canonicalIds.length,
      storedCount: Number(business.branchCount || 0),
      reviewLinkedBranchIds: reviewIds,
      missingLinks,
      staleLinks,
      primary,
      canonicalPrimary,
      incompleteBranchIds: incomplete.map((branch) => branch.id)
    });
  }

  if (applyLinks && canonicalIds.length) {
    await db.collection("businesses").doc(business.id).set({
      branchIds: canonicalIds,
      branchCount: canonicalIds.length,
      primaryBranchId: canonicalPrimary,
      primaryLocationId: canonicalPrimary,
      updatedAt: FieldValue.serverTimestamp(),
      locationIntegrityRepairedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

const orphanBranches = branches.filter((branch) => !branch.businessId || !businesses.has(branch.businessId));
const duplicateMap = new Map();
for (const branch of branches) {
  const key = signature(branch);
  if (!duplicateMap.has(key)) duplicateMap.set(key, []);
  duplicateMap.get(key).push(branch);
}
const duplicateGroups = [...duplicateMap.values()].filter((group) => group.length > 1);

console.log(JSON.stringify({
  projectId,
  applyLinks,
  totals: {
    businesses: businesses.size,
    branches: branches.length,
    locationReviews: reviewSnapshot.docs?.length || 0,
    launchReviews: launchReviewSnapshot.docs?.length || 0,
    businessClaims: claimSnapshot.docs?.length || 0,
    businessesWithIntegrityProblems: problems.length,
    safeBranchRepairs: safeBranchRepairs.length,
    unsafeMismatches: unsafeMismatches.length,
    missingBranchDocuments: missingBranchDocuments.length,
    orphanBranches: orphanBranches.length,
    possibleDuplicateGroups: duplicateGroups.length
  },
  problems,
  safeBranchRepairs,
  unsafeMismatches,
  missingBranchDocuments,
  orphanBranches: orphanBranches.map((branch) => ({ id: branch.id, businessId: branch.businessId || null, organizationId: branch.organizationId || null, name: branch.branchName || branch.name || "" })),
  possibleDuplicates: duplicateGroups.map((group) => group.map((branch) => ({ id: branch.id, businessId: branch.businessId || null, name: branch.branchName || branch.name || "", city: branch.city || "", address: branch.address || "" })))
}, null, 2));

if (applyLinks) console.log("Safe Business/location link repairs complete. No branch documents or duplicate locations were deleted.");
