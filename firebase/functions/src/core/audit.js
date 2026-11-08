import { FieldValue } from "firebase-admin/firestore";
import { spotlyAdmin } from "./admin.js";

export async function writeFunctionAudit({ action, actor = null, entityType, entityId, metadata = {}, requestId = null }) {
  const { firestore } = spotlyAdmin();
  const ref = firestore.collection("auditLogs").doc();
  await ref.set({
    action,
    entityType,
    entityId,
    actorId: actor?.uid || null,
    actorEmail: actor?.token?.email || null,
    metadata,
    source: "firebase_function",
    requestId,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}
