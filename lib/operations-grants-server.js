import "server-only";
import { operationContext, operationGrantMatches } from "./operations-grants.js";

function iso(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeOperationGrant(id, grant = {}) {
  return {
    id,
    userId: grant.userId || "",
    type: grant.type || "",
    status: grant.status || "active",
    services: Array.isArray(grant.services) ? grant.services : [],
    countries: Array.isArray(grant.countries) ? grant.countries : [],
    cities: Array.isArray(grant.cities) ? grant.cities : [],
    reason: grant.reason || "",
    createdBy: grant.createdBy || "",
    createdAt: iso(grant.createdAt),
    expiresAt: iso(grant.expiresAt),
    revokedBy: grant.revokedBy || null,
    revokedAt: iso(grant.revokedAt)
  };
}

export async function loadOperationGrants(db, userId, { includeInactive = false } = {}) {
  if (!userId) return [];
  const snapshot = await db.collection("operationGrants").where("userId", "==", userId).limit(100).get();
  const grants = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (includeInactive) return grants;
  const now = new Date();
  return grants.filter((grant) => operationGrantMatches(grant, { type: grant.type, now }));
}

export async function operationContextFor(db, userId, scope = {}) {
  const grants = await loadOperationGrants(db, userId);
  return { grants, context: operationContext(grants, scope) };
}

export async function requireOperationGrant(db, userId, context) {
  const grants = await loadOperationGrants(db, userId);
  const match = grants.find((grant) => operationGrantMatches(grant, context));
  if (!match) throw Object.assign(new Error("This account does not have the required Operations grant for this action."), { status: 403, code: "operations_grant_required" });
  return match;
}
