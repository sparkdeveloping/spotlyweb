import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { hasNxtPermission, nxtRole } from "@/lib/nxt-policy";

export function requireNxt(actor, permission = "read") {
  if (!actor?.uid || !hasNxtPermission(actor.profile, permission)) {
    throw Object.assign(new Error("NXT workspace access is required for this action."), { status: 403 });
  }
  return { uid: actor.uid, role: nxtRole(actor.profile) || "spotly_admin" };
}
export function iso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  const dt = new Date(v); return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}
export function serial(doc) {
  const d = doc.data() || {};
  return { id: doc.id, ...d, createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt), contactedAt: iso(d.contactedAt), followUpAt: iso(d.followUpAt), occurredAt: iso(d.occurredAt) };
}
export function audit(db, actor, action, entityType, entityId, fields = {}) {
  return db.collection("auditLogs").doc().set({ action, entityType, entityId, actorId: actor.uid, actorEmail: actor.email || "", metadata: fields, createdAt: FieldValue.serverTimestamp() });
}
export function noStore(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
