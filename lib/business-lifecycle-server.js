import "server-only";
import { getBusinessLifecycle } from "@/lib/business-lifecycle";

function rows(snapshot) {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function allRowsByBusiness(db, collectionName, businessId, pageSize = 500) {
  const result = [];
  const base = db.collection(collectionName).where("businessId", "==", businessId);
  let cursor = null;
  while (true) {
    let query = base.limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    result.push(...rows(snapshot));
    if (snapshot.size < pageSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  return result;
}

export async function loadBusinessLifecycleData(db, businessId, { membership = null, userId = "" } = {}) {
  const businessRef = db.collection("businesses").doc(businessId);
  // Keep lifecycle reads on single-field indexes so a missing composite index can never take
  // the merchant launch experience down. Small bounded result sets are filtered/merged here.
  const [businessSnapshot, branchesSnapshot, products, operationsSnapshot, claimsSnapshot, invitationsSnapshot, directMembersSnapshot, scopedMembersSnapshot, platformSnapshot] = await Promise.all([
    businessRef.get(),
    db.collection("branches").where("businessId", "==", businessId).limit(100).get(),
    allRowsByBusiness(db, "products", businessId),
    db.collection("businessOperationalSettings").doc(businessId).get(),
    userId ? db.collection("businessClaims").where("businessId", "==", businessId).limit(100).get() : Promise.resolve({ docs: [] }),
    db.collection("businessInvitations").where("businessId", "==", businessId).limit(100).get(),
    db.collection("memberships").where("businessId", "==", businessId).limit(100).get(),
    db.collection("memberships").where("businessIds", "array-contains", businessId).limit(100).get(),
    db.collection("platformSettings").doc("global").get()
  ]);
  if (!businessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
  const business = { id: businessSnapshot.id, ...businessSnapshot.data() };
  const members = [...new Map([...rows(directMembersSnapshot), ...rows(scopedMembersSnapshot)].map((member) => [member.id, member])).values()];
  const resolvedMembership = membership || members.find((member) => member.userId === userId && member.status !== "revoked" && member.status !== "inactive") || null;
  const input = {
    business,
    branches: rows(branchesSnapshot),
    products,
    operations: operationsSnapshot.exists ? operationsSnapshot.data() : {},
    claims: rows(claimsSnapshot).filter((claim) => !userId || claim.applicantId === userId),
    invitations: rows(invitationsSnapshot),
    members,
    membership: resolvedMembership,
    selectedBusinessId: businessId,
    platformSettings: platformSnapshot.exists ? platformSnapshot.data() : {}
  };
  return { input, lifecycle: getBusinessLifecycle(input) };
}

export function publicLifecycleSnapshot(lifecycle) {
  return {
    stage: lifecycle.stage,
    stageNumber: lifecycle.stageNumber,
    stageCount: lifecycle.stageCount,
    stageLabel: lifecycle.stageLabel,
    businessState: lifecycle.businessState,
    merchantProgress: lifecycle.merchantProgress,
    merchantWorkComplete: lifecycle.merchantWorkComplete,
    merchantActionCount: lifecycle.merchantActionCount,
    externalReviewCount: lifecycle.externalReviewCount,
    nextAction: lifecycle.nextAction,
    canOperate: lifecycle.canOperate,
    canTakeOrders: lifecycle.canTakeOrders,
    canUseKiosk: lifecycle.canUseKiosk,
    canUseInsights: lifecycle.canUseInsights,
    canUsePromotions: lifecycle.canUsePromotions,
    canSubmitLaunchReview: lifecycle.canSubmitLaunchReview,
    statusLabel: lifecycle.statusLabel,
    defaultHref: lifecycle.defaultHref,
    launchChecks: lifecycle.launchChecks,
    launchReview: lifecycle.launchReview,
    access: lifecycle.access,
    setup: {
      percent: lifecycle.setup.percent,
      complete: lifecycle.setup.complete,
      requiredComplete: lifecycle.setup.requiredComplete,
      requiredTotal: lifecycle.setup.requiredTotal,
      firstIncompleteId: lifecycle.setup.firstIncompleteId
    }
  };
}
