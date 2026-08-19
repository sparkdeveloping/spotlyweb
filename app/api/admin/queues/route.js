import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { safeText } from "@/lib/server-helpers";
import { notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";

const QUEUES = {
  "business-claims": { collection: "businessClaims", permission: "claims.review", roles: ["verification_officer"], sort: "createdAt" },
  support: { collection: "supportConversations", permission: "support.read", roles: ["support_agent", "support_manager"], sort: "createdAt" },
  "payment-exceptions": { collection: "paymentReconciliationIssues", permission: "finance.read", roles: ["finance_admin"], sort: "createdAt" },
  "publication-review": { collection: "adminTasks", permission: "businesses.read", roles: ["business_success_manager", "operations_manager"], sort: "createdAt" },
  "staff-approvals": { collection: "adminTasks", permission: "people.approve", roles: ["operations_manager", "regional_operations_manager", "people_admin", "people_operations_admin"], sort: "createdAt" },
  incidents: { collection: "adminTasks", permission: "operations.read", roles: ["operations_manager", "regional_operations_manager"], sort: "createdAt" }
};

const querySchema = z.object({
  queue: z.string().min(2).max(80),
  cursor: z.string().max(600).optional(),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
  q: z.string().max(160).optional().default(""),
  status: z.string().max(80).optional().default("open"),
  owner: z.string().max(180).optional().default("all"),
  priority: z.string().max(80).optional().default("all")
});

const actionSchema = z.object({
  queue: z.string().min(2).max(80),
  id: z.string().min(3).max(200),
  action: z.enum(["assign", "decision"]),
  decision: z.string().max(80).optional(),
  reason: z.string().max(1000).optional().default("")
});

function queueMeta(queue) {
  const meta = QUEUES[queue];
  if (!meta) throw Object.assign(new Error("That admin queue does not exist."), { status: 404 });
  return meta;
}

function authorize(user, queue) {
  const meta = queueMeta(queue);
  requirePlatformPermission(user, meta.permission, { roles: meta.roles });
  return meta;
}

function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function encodeCursor(value) {
  return value ? Buffer.from(JSON.stringify(value)).toString("base64url") : null;
}
function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Number.isFinite(Number(parsed.t)) || !parsed.id) return null;
    return { t: Number(parsed.t), id: String(parsed.id) };
  } catch { return null; }
}

function queueSpecific(queue, item) {
  if (queue === "publication-review") return ["business_publication_review", "business_launch_review", "business_location_review"].includes(item.type);
  if (queue === "staff-approvals") return String(item.type || "").includes("staff") || String(item.type || "").includes("leave") || String(item.type || "").includes("people");
  if (queue === "incidents") return ["failed", "urgent", "escalated"].includes(String(item.status || "")) || item.priority === "urgent";
  return true;
}

function userFilters(item, { q, status, owner, priority }, uid) {
  if (!queueSpecific(item.__queue, item)) return false;
  const recordStatus = String(item.status || "open");
  const statusMatch = status === "all" || (status === "open"
    ? !["completed", "closed", "resolved", "paid", "rejected", "approved", "refunded"].includes(recordStatus)
    : recordStatus === status);
  const ownerMatch = owner === "all" || (owner === "mine" ? item.assignedTo === uid : owner === "unassigned" ? !item.assignedTo : item.assignedTo === owner);
  const priorityMatch = priority === "all" || String(item.priority || "normal") === priority;
  const text = [item.id, item.title, item.subject, item.applicantName, item.applicantEmail, item.requesterName, item.requesterEmail, item.type, item.priority, recordStatus, item.businessName, item.description, item.lastMessage].filter(Boolean).join(" ").toLowerCase();
  return statusMatch && ownerMatch && priorityMatch && text.includes(String(q || "").toLowerCase());
}

async function enrichBusinesses(db, records) {
  const ids = [...new Set(records.map((item) => item.businessId || item.entityId).filter(Boolean))];
  if (!ids.length) return records;
  const refs = ids.map((id) => db.collection("businesses").doc(id));
  const snapshots = await db.getAll(...refs);
  const names = new Map(snapshots.filter((item) => item.exists).map((item) => [item.id, item.data().name || item.data().brandName || item.id]));
  return records.map((item) => ({ ...item, businessName: item.businessName || names.get(item.businessId || item.entityId) || "" }));
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const filters = querySchema.parse(params);
    const meta = authorize(user, filters.queue);
    const { db } = getAdminServices();
    const scanSize = 100;
    const maxScan = 1000;
    const target = filters.pageSize;
    let cursor = decodeCursor(filters.cursor);
    let scanned = 0;
    let exhausted = false;
    let lastScanned = cursor;
    const found = [];

    while (found.length < target && scanned < maxScan && !exhausted) {
      let query = db.collection(meta.collection).orderBy(meta.sort, "desc").orderBy(FieldPath.documentId(), "desc");
      if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.t), cursor.id);
      const snapshot = await query.limit(scanSize).get();
      if (snapshot.empty) { exhausted = true; break; }
      scanned += snapshot.size;
      let processedBatch = 0;
      for (const doc of snapshot.docs) {
        processedBatch += 1;
        const item = { id: doc.id, ...doc.data(), __queue: filters.queue };
        const nextCursor = { t: millis(doc.get(meta.sort)), id: doc.id };
        lastScanned = nextCursor;
        cursor = nextCursor;
        if (userFilters(item, filters, user.uid)) found.push(item);
        if (found.length >= target) break;
      }
      if (snapshot.size < scanSize && processedBatch >= snapshot.size) exhausted = true;
    }

    const items = await enrichBusinesses(db, found.slice(0, target));
    return Response.json({
      ok: true,
      queue: filters.queue,
      items: items.map(({ __queue, ...item }) => item),
      nextCursor: !exhausted && lastScanned ? encodeCursor(lastScanned) : null,
      scanned,
      pageSize: target
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the queue filters.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

const DECISIONS = {
  support: new Set(["assigned", "escalated", "resolved", "closed"]),
  "payment-exceptions": new Set(["assigned", "investigating", "resolved", "escalated"]),
  "publication-review": new Set(["assigned", "in_progress", "completed", "escalated"]),
  "staff-approvals": new Set(["assigned", "in_progress", "completed", "escalated"]),
  incidents: new Set(["assigned", "in_progress", "completed", "escalated"])
};

export async function PATCH(request) {
  try {
    const user = await authenticateRequest(request);
    const body = actionSchema.parse(await request.json());
    const meta = authorize(user, body.queue);
    if (body.queue === "business-claims" && body.action === "decision") throw Object.assign(new Error("Use the claim decision workflow for verification decisions."), { status: 409 });
    const { db, messaging, auth } = getAdminServices();
    const ref = db.collection(meta.collection).doc(body.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("The queue record was not found."), { status: 404 });
    const record = snapshot.data();
    const changes = { updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid };

    if (body.action === "assign") {
      changes.assignedTo = user.uid;
      changes.assignedAt = FieldValue.serverTimestamp();
      if (!record.status || record.status === "open") changes.status = "assigned";
    } else {
      if (!body.decision || !DECISIONS[body.queue]?.has(body.decision)) throw Object.assign(new Error("That decision is not valid for this queue."), { status: 422 });
      changes.status = body.decision;
      changes.decisionReason = safeText(body.reason, 1000);
      changes.reviewedBy = user.uid;
      changes.reviewedAt = FieldValue.serverTimestamp();
    }

    const batch = db.batch();
    batch.set(ref, changes, { merge: true });
    batch.create(db.collection("auditLogs").doc(), {
      action: body.action === "assign" ? "admin_queue.assigned" : "admin_queue.decision",
      entityType: meta.collection,
      entityId: body.id,
      actorId: user.uid,
      actorEmail: user.email || "",
      metadata: { queue: body.queue, decision: body.decision || null, reason: safeText(body.reason, 1000) },
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
    if (body.action === "decision" && record.requestedBy && ["staff-approvals", "publication-review"].includes(body.queue)) {
      const workspace = body.queue === "staff-approvals" ? "staff" : "business";
      await notifyUser({
        db, messaging, auth, userId: record.requestedBy,
        title: body.decision === "completed" ? "Review completed" : body.decision === "escalated" ? "Review escalated" : "Review updated",
        body: safeText(body.reason || record.title || "Open Spotly to see the latest review activity.", 700),
        href: "/notifications",
        category: `${workspace}_review`, workspace, module: "reviews", eventType: `${body.queue}.${body.decision}`, importance: "high",
        businessId: record.businessId || null, entityType: meta.collection, entityId: body.id, email: true, forceOperationalEmail: true
      }).catch(() => {});
    }
    return Response.json({ ok: true, id: body.id, changes: { ...changes, updatedAt: undefined, assignedAt: undefined, reviewedAt: undefined } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the queue action.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
