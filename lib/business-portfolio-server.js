import "server-only";

import { FieldPath } from "firebase-admin/firestore";
import { toPlainTimestamp } from "@/lib/server-helpers";
import { getBusinessLifecycle } from "@/lib/business-lifecycle";
import { mergeLifecycleBusinessState, publicLifecycleSnapshot } from "@/lib/business-lifecycle-server";
import { loadCanonicalBusinessBranches } from "@/lib/business-branches-server";

const BUSINESS_WIDE_ROLES = new Set(["organization_owner", "business_owner", "business_manager"]);

function activeMembership(membership) {
  if (!membership || membership.status !== "active") return false;
  if (!membership.expiresAt) return true;
  const value = typeof membership.expiresAt?.toDate === "function" ? membership.expiresAt.toDate() : new Date(membership.expiresAt);
  return Number.isNaN(value.getTime()) || value.getTime() > Date.now();
}

function chunks(values, size = 30) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function queryBusinessIds(db, ids) {
  if (!ids.length) return [];
  const result = [];
  for (const group of chunks([...new Set(ids)])) {
    const snapshots = await db.collection("businesses").where(FieldPath.documentId(), "in", group).get();
    result.push(...snapshots.docs);
  }
  return result;
}

async function queryBusinessesByOrganizations(db, organizationIds) {
  if (!organizationIds.length) return [];
  const result = [];
  for (const group of chunks([...new Set(organizationIds)])) {
    const base = db.collection("businesses").where("organizationId", "in", group);
    let cursor = null;
    while (true) {
      let query = base.limit(500);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      result.push(...snapshot.docs);
      if (snapshot.size < 500) break;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
  }
  return result;
}

async function recordsByBusiness(db, collectionName, businessIds, pageSize = 500) {
  const records = new Map();
  if (!businessIds.length) return records;
  for (const group of chunks(businessIds)) {
    const base = db.collection(collectionName).where("businessId", "in", group);
    let cursor = null;
    while (true) {
      let query = base.limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      snapshot.docs.forEach((item) => {
        const data = { id: item.id, ...item.data() };
        const businessId = data.businessId;
        if (!records.has(businessId)) records.set(businessId, []);
        records.get(businessId).push(data);
      });
      if (snapshot.size < pageSize) break;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
  }
  return records;
}


async function canonicalBranchesByBusiness(db, businessIds) {
  const result = new Map();
  const records = await Promise.all(businessIds.map(async (businessId) => {
    try {
      const resolved = await loadCanonicalBusinessBranches(db, businessId, { repair: true });
      return [businessId, resolved.branches];
    } catch {
      return [businessId, []];
    }
  }));
  records.forEach(([businessId, branches]) => result.set(businessId, branches));
  return result;
}

async function operationalStates(db, businessIds) {
  if (!businessIds.length) return new Map();
  const snapshots = await db.getAll(...businessIds.map((id) => db.collection("businessOperationalSettings").doc(id)));
  return new Map(snapshots.filter((item) => item.exists).map((item) => [item.id, item.data()]));
}

async function financeStates(db, businessIds) {
  if (!businessIds.length) return new Map();
  const snapshots = await db.getAll(...businessIds.map((id) => db.collection("businessSettlementAccounts").doc(id)));
  return new Map(snapshots.filter((item) => item.exists).map((item) => [item.id, item.data()]));
}

function membershipScope(membership, businessId) {
  if (!membership) return { businessWide: false, branchIds: [], permissions: [], role: "" };
  const businessWide = BUSINESS_WIDE_ROLES.has(membership.role) || membership.role === "organization_owner";
  return {
    businessWide,
    branchIds: businessWide ? [] : [...new Set(membership.branchIds || [])],
    permissions: [...new Set(membership.permissions || [])],
    role: membership.role || "member"
  };
}

function roleLabel(role = "") {
  const labels = {
    organization_owner: "Organization owner",
    business_owner: "Owner",
    business_manager: "Business manager",
    branch_manager: "Location manager",
    finance_manager: "Finance manager",
    order_manager: "Orders manager",
    catalog_manager: "Catalogue manager",
    order_staff: "Orders staff",
    picker: "Pickup staff",
    finance_viewer: "Finance viewer",
    custom: "Custom access"
  };
  return labels[role] || role.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()) || "Business member";
}

function claimNeedsAction(claim) {
  return ["information_requested", "changes_requested", "parent_approval_required", "draft"].includes(claim.status);
}

function claimClosed(claim) {
  return ["approved", "rejected", "withdrawn", "closed"].includes(claim.status);
}

export async function getBusinessPortfolio(db, user) {
  const membershipSnapshot = await db.collection("memberships").where("userId", "==", user.uid).limit(250).get();
  const memberships = membershipSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(activeMembership);
  const organizationWideIds = memberships.filter((item) => item.role === "organization_owner").map((item) => item.organizationId).filter(Boolean);
  const explicitBusinessIds = memberships.flatMap((item) => [item.businessId, ...(item.businessIds || [])]).filter(Boolean);

  const [explicitDocs, organizationDocs, directlyOwned, claimsSnapshot, invitationSnapshot] = await Promise.all([
    queryBusinessIds(db, explicitBusinessIds),
    queryBusinessesByOrganizations(db, organizationWideIds),
    db.collection("businesses").where("ownerIds", "array-contains", user.uid).limit(250).get(),
    db.collection("businessClaims").where("applicantId", "==", user.uid).limit(100).get(),
    user.email ? db.collection("businessInvitations").where("email", "==", String(user.email).toLowerCase()).limit(100).get() : Promise.resolve({ docs: [] })
  ]);

  const businessDocs = new Map();
  [...explicitDocs, ...organizationDocs, ...directlyOwned.docs].forEach((doc) => businessDocs.set(doc.id, doc));
  const businessIds = [...businessDocs.keys()];
  // Portfolio summaries use the same lifecycle engine as the selected-business workspace.
  // Batch reads avoid one-query-per-business N+1 behavior while keeping lifecycle percentages truthful.
  const [branchesByBusiness, productsByBusiness, operationsByBusiness, settlement, platformSnapshot] = await Promise.all([
    canonicalBranchesByBusiness(db, businessIds),
    recordsByBusiness(db, "products", businessIds),
    operationalStates(db, businessIds),
    financeStates(db, businessIds),
    db.collection("platformSettings").doc("global").get()
  ]);

  const membershipByOrganization = new Map(memberships.filter((item) => item.organizationId).map((item) => [item.organizationId, item]));
  const membershipByBusiness = new Map();
  memberships.forEach((item) => {
    if (item.businessId) membershipByBusiness.set(item.businessId, item);
    (item.businessIds || []).forEach((id) => membershipByBusiness.set(id, item));
  });

  const businesses = [...businessDocs.values()].map((doc) => {
    const data = doc.data();
    const membership = membershipByBusiness.get(doc.id) || membershipByOrganization.get(data.organizationId) || null;
    const directOwner = (data.ownerIds || []).includes(user.uid);
    const scope = membershipScope(membership, doc.id);
    const role = directOwner && !scope.role ? "business_owner" : scope.role || (directOwner ? "business_owner" : "member");
    const account = settlement.get(doc.id) || null;
    const enrichedBusiness = mergeLifecycleBusinessState({ id: doc.id, ...data }, account);
    const userClaims = claimsSnapshot.docs.map((claimDoc) => ({ id: claimDoc.id, ...claimDoc.data() })).filter((claim) => claim.businessId === doc.id);
    const userInvitations = invitationSnapshot.docs.map((invitationDoc) => ({ id: invitationDoc.id, ...invitationDoc.data() })).filter((invite) => invite.businessId === doc.id);
    const lifecycle = getBusinessLifecycle({
      business: enrichedBusiness,
      branches: branchesByBusiness.get(doc.id) || [],
      products: productsByBusiness.get(doc.id) || [],
      operations: operationsByBusiness.get(doc.id) || {},
      claims: userClaims,
      invitations: userInvitations,
      members: membership ? [membership] : [],
      membership: membership || (directOwner ? { role: "business_owner", status: "active", userId: user.uid, businessId: doc.id } : null),
      selectedBusinessId: doc.id,
      platformSettings: platformSnapshot.exists ? platformSnapshot.data() : {}
    });
    const lifecycleSnapshot = publicLifecycleSnapshot(lifecycle);
    const setupComplete = lifecycleSnapshot.setup.complete;
    const attention = [];
    if (lifecycleSnapshot.nextAction && (lifecycleSnapshot.stage !== "live" || !lifecycleSnapshot.canOperate)) attention.push({ type: lifecycleSnapshot.nextAction.id, label: lifecycleSnapshot.nextAction.label, href: lifecycleSnapshot.nextAction.href });
    if (lifecycleSnapshot.launchReview.state === "action_required") attention.push({ type: "launch_review", label: "Spotly requested launch changes", href: lifecycleSnapshot.launchReview.href });
    if (data.status === "paused") attention.push({ type: "status", label: "Business is temporarily paused", href: lifecycleSnapshot.defaultHref });
    return {
      id: doc.id,
      name: data.brandName || data.name || "Business",
      legalName: data.legalName || "",
      logo: data.logo || "",
      organizationId: data.organizationId || null,
      organizationName: data.organizationName || "",
      category: data.category || data.categories?.[0] || "Business",
      city: data.city || "",
      status: data.status || "active",
      public: data.public === true,
      verificationStatus: data.verificationStatus || data.claimStatus || "verified",
      setupComplete,
      onboardingStatus: data.onboardingStatus || (setupComplete ? "complete" : "incomplete"),
      lifecycleStage: lifecycleSnapshot.stage,
      lifecycleLabel: lifecycleSnapshot.statusLabel,
      merchantProgress: lifecycleSnapshot.merchantProgress,
      defaultHref: lifecycleSnapshot.defaultHref,
      lifecycleActionLabel: lifecycleSnapshot.nextAction?.actionLabel || (lifecycleSnapshot.stage === "live" ? "Open business" : lifecycleSnapshot.stage === "review" ? "View Spotly review" : "Open launch checklist"),
      launchReviewStatus: lifecycleSnapshot.launchReview.status || "",
      externalReviewCount: lifecycleSnapshot.externalReviewCount,
      merchantActionCount: lifecycleSnapshot.merchantActionCount,
      role,
      roleLabel: roleLabel(role),
      businessWide: directOwner || scope.businessWide,
      branchIds: scope.branchIds,
      accessibleLocationCount: directOwner || scope.businessWide ? (branchesByBusiness.get(doc.id)?.length || 0) : scope.branchIds.length,
      permissions: scope.permissions,
      attention
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const claims = claimsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      businessId: data.businessId || null,
      businessName: data.businessName || data.businessSnapshot?.name || data.newBusiness?.name || "Business application",
      claimType: data.claimType || "business_claim",
      requestedScope: data.requestedScope || data.accessScope || data.scope || [],
      status: data.status || "submitted",
      nextAction: data.nextAction || data.informationRequest || data.reviewNotes || "",
      needsAction: claimNeedsAction(data),
      closed: claimClosed(data),
      submittedAt: toPlainTimestamp(data.submittedAt || data.createdAt),
      updatedAt: toPlainTimestamp(data.updatedAt || data.reviewedAt || data.submittedAt || data.createdAt)
    };
  }).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  const invitations = invitationSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      businessId: data.businessId || null,
      businessName: data.businessName || businesses.find((item) => item.id === data.businessId)?.name || "Business invitation",
      organizationId: data.organizationId || null,
      organizationName: data.organizationName || "",
      role: data.role || "member",
      roleLabel: roleLabel(data.role || "member"),
      branchIds: data.branchIds || [],
      permissions: data.permissions || [],
      invitedByName: data.invitedByName || "",
      status: data.status || "pending",
      expiresAt: toPlainTimestamp(data.expiresAt),
      createdAt: toPlainTimestamp(data.createdAt),
      updatedAt: toPlainTimestamp(data.updatedAt)
    };
  }).filter((item) => item.status === "pending");

  const attention = [
    ...claims.filter((item) => item.needsAction).map((item) => ({ id: `claim:${item.id}`, type: "claim", businessId: item.businessId, businessName: item.businessName, title: item.nextAction || "Business claim needs your attention", href: `/claim/status/${item.id}`, priority: 1, updatedAt: item.updatedAt })),
    ...invitations.map((item) => ({ id: `invite:${item.id}`, type: "invitation", businessId: item.businessId, businessName: item.businessName, title: `Invitation: ${item.roleLabel}`, href: `/business/invitations?invitation=${item.id}`, priority: 1, updatedAt: item.createdAt })),
    ...businesses.flatMap((business) => business.attention.map((item, index) => ({ id: `business:${business.id}:${index}`, businessId: business.id, businessName: business.name, title: item.label, href: item.href, type: item.type, priority: item.type === "money" ? 2 : 3, updatedAt: null })))
  ].sort((a, b) => a.priority - b.priority || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  return { businesses, claims, invitations, attention };
}
