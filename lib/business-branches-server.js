import "server-only";

import { FieldValue } from "firebase-admin/firestore";

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function label(branch = {}) {
  return String(branch.branchName || branch.name || branch.displayName || "").trim();
}

function sortBranches(records = []) {
  return [...records].sort((a, b) => label(a).localeCompare(label(b), "en", { sensitivity: "base" }));
}

function sameOrganization(branch = {}, business = {}) {
  if (!branch.organizationId || !business.organizationId) return false;
  return String(branch.organizationId) === String(business.organizationId);
}

async function conflictingBusinessLink(db, branchId, businessId) {
  const snapshot = await db.collection("businesses").where("branchIds", "array-contains", branchId).limit(5).get();
  return snapshot.docs.some((doc) => doc.id !== businessId);
}

/**
 * Resolve the canonical branch set for a Business from both directions of the relationship.
 *
 * Historical Spotly data can contain a branch that is linked from businesses/{id}.branchIds
 * but has a missing/stale branch.businessId. A query by businessId alone then makes the branch
 * disappear from Business even though Admin/review records still know about it. This resolver
 * merges both sources, reports drift, and can safely repair one-sided links without deleting data.
 */
export async function loadCanonicalBusinessBranches(db, businessId, { repair = false, businessSnapshot = null } = {}) {
  const businessRef = db.collection("businesses").doc(businessId);
  const resolvedBusinessSnapshot = businessSnapshot || await businessRef.get();
  if (!resolvedBusinessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
  const business = { id: resolvedBusinessSnapshot.id, ...resolvedBusinessSnapshot.data() };

  const [directSnapshot, locationReviewSnapshot, launchReviewSnapshot, claimSnapshot] = await Promise.all([
    db.collection("branches").where("businessId", "==", businessId).limit(500).get(),
    // Review records are authoritative breadcrumbs. They let Business rediscover exact
    // location documents that Admin can review even if an older write lost one side of the
    // Business ↔ branch relationship. These are all single-field queries.
    db.collection("businessLocationReviews").where("businessId", "==", businessId).limit(250).get().catch(() => null),
    db.collection("businessLaunchReviews").where("businessId", "==", businessId).limit(100).get().catch(() => null),
    db.collection("businessClaims").where("businessId", "==", businessId).limit(100).get().catch(() => null)
  ]);
  const direct = directSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const directIds = new Set(direct.map((item) => item.id));
  const locationReviewLinkedIds = unique(locationReviewSnapshot?.docs?.map((doc) => doc.data()?.branchId) || []);
  const launchReviewLinkedIds = unique((launchReviewSnapshot?.docs || []).flatMap((doc) => {
    const data = doc.data() || {};
    return [data.branchId, ...(Array.isArray(data.branchIdsSnapshot) ? data.branchIdsSnapshot : []), ...(Array.isArray(data.branchIds) ? data.branchIds : [])];
  }));
  const claimLinkedIds = unique((claimSnapshot?.docs || []).flatMap((doc) => {
    const data = doc.data() || {};
    return [data.branchId, ...(Array.isArray(data.branchIds) ? data.branchIds : [])];
  }));
  const reviewLinkedIds = unique([...locationReviewLinkedIds, ...launchReviewLinkedIds, ...claimLinkedIds]);
  const businessLinkedIds = unique([
    ...(Array.isArray(business.branchIds) ? business.branchIds : []),
    business.primaryBranchId,
    business.primaryLocationId,
    business.defaultBranchId
  ]);

  const linkedIds = unique([
    ...businessLinkedIds,
    ...reviewLinkedIds
  ]);
  const missingLinkedIds = linkedIds.filter((id) => !directIds.has(id));
  const linkedSnapshots = missingLinkedIds.length
    ? await db.getAll(...missingLinkedIds.map((id) => db.collection("branches").doc(id)))
    : [];

  const byId = new Map(direct.map((item) => [item.id, item]));
  const safeRepairIds = [];
  const unsafeMismatches = [];
  const missingDocuments = [];

  for (const snapshot of linkedSnapshots) {
    if (!snapshot.exists) {
      missingDocuments.push(snapshot.id);
      continue;
    }
    const branch = { id: snapshot.id, ...snapshot.data() };
    const currentBusinessId = String(branch.businessId || "").trim();
    const reviewEvidence = reviewLinkedIds.includes(branch.id);
    const businessLinkEvidence = businessLinkedIds.includes(branch.id);
    const safeOrganization = sameOrganization(branch, business) || (!branch.organizationId && !business.organizationId);
    // A trusted Business link or server-created review/claim is strong linkage evidence for
    // historical records that lost businessId/organizationId. Never steal a branch already
    // linked to another Business.
    let canRepair = !currentBusinessId && (businessLinkEvidence || safeOrganization || reviewEvidence) && !(await conflictingBusinessLink(db, branch.id, businessId));
    if (currentBusinessId && currentBusinessId !== businessId && safeOrganization && reviewEvidence) {
      canRepair = !(await conflictingBusinessLink(db, branch.id, businessId));
    }
    if (currentBusinessId === businessId || canRepair) {
      byId.set(branch.id, branch);
      if (currentBusinessId !== businessId) safeRepairIds.push(branch.id);
    } else {
      unsafeMismatches.push({ id: branch.id, businessId: currentBusinessId || null, organizationId: branch.organizationId || null });
    }
  }

  const branches = sortBranches([...byId.values()]);
  const canonicalIds = branches.map((item) => item.id);
  const storedIds = unique(Array.isArray(business.branchIds) ? business.branchIds : []);
  const primary = business.primaryBranchId || business.primaryLocationId || business.defaultBranchId || "";
  const canonicalPrimary = canonicalIds.includes(primary) ? primary : (canonicalIds[0] || "");
  const linkDrift = canonicalIds.length !== storedIds.length || canonicalIds.some((id) => !storedIds.includes(id));
  const countDrift = Number(business.branchCount || 0) !== canonicalIds.length;
  const primaryDrift = Boolean(canonicalPrimary) && canonicalPrimary !== primary;

  if (repair && (safeRepairIds.length || linkDrift || countDrift || primaryDrift || (primary && !canonicalPrimary))) {
    const batch = db.batch();
    for (const branchId of safeRepairIds) {
      batch.set(db.collection("branches").doc(branchId), {
        businessId,
        organizationId: business.organizationId || null,
        locationIntegrityRepairedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    const businessRepair = {
      branchIds: canonicalIds,
      branchCount: canonicalIds.length,
      locationIntegrityRepairedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    if (canonicalPrimary) {
      businessRepair.primaryBranchId = canonicalPrimary;
      businessRepair.primaryLocationId = canonicalPrimary;
    } else {
      businessRepair.primaryBranchId = FieldValue.delete();
      businessRepair.primaryLocationId = FieldValue.delete();
      businessRepair.defaultBranchId = FieldValue.delete();
    }
    batch.set(businessRef, businessRepair, { merge: true });
    await batch.commit();
  }

  return {
    business,
    branches,
    diagnostics: {
      directCount: direct.length,
      resolvedCount: branches.length,
      linkedIds,
      reviewLinkedIds,
      businessLinkedIds,
      locationReviewLinkedIds,
      launchReviewLinkedIds,
      claimLinkedIds,
      safeRepairIds,
      missingDocuments,
      unsafeMismatches,
      linkDrift,
      countDrift,
      primaryDrift,
      canonicalPrimary
    }
  };
}
