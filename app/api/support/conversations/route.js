import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { hasPlatformPermission, isPlatformAdmin, requireBusinessPermission } from "@/lib/access-control-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const attachment = z.object({
  name: z.string().min(1).max(220),
  type: z.string().max(120).optional(),
  size: z.number().nonnegative().max(10 * 1024 * 1024).optional(),
  path: z.string().min(1).max(800),
  url: z.string().url().max(2000)
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().max(160).optional(),
    email: z.string().email().max(254).optional().or(z.literal("")),
    audience: z.enum(["public", "customer", "business", "driver", "staff"]).default("public"),
    subject: z.string().min(3).max(180),
    category: z.string().min(1).max(80).default("general"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    message: z.string().min(1).max(6000),
    businessId: z.string().max(180).nullable().optional(),
    contextType: z.string().max(80).nullable().optional(),
    contextId: z.string().max(220).nullable().optional(),
    context: z.record(z.string(), z.unknown()).nullable().optional()
  }),
  z.object({
    action: z.literal("message"),
    conversationId: z.string().min(3).max(180),
    body: z.string().min(1).max(6000),
    attachments: z.array(attachment).max(6).default([]),
    context: z.record(z.string(), z.unknown()).nullable().optional(),
    internal: z.boolean().default(false),
    status: z.enum(["open", "waiting_for_spotly", "waiting_for_user"]).optional(),
    senderName: z.string().max(160).optional(),
    senderRole: z.string().max(80).optional()
  }),
  z.object({
    action: z.literal("update"),
    conversationId: z.string().min(3).max(180),
    status: z.enum(["open", "assigned", "waiting_for_spotly", "waiting_for_user", "escalated", "resolved", "closed"]).optional(),
    assignedTo: z.string().max(180).nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    satisfaction: z.number().int().min(1).max(5).optional()
  })
]);

function supportStaff(user) {
  const roles = user?.profile?.roles || [];
  return isPlatformAdmin(user) || hasPlatformPermission(user, "support.read") || hasPlatformPermission(user, "support.respond") || hasPlatformPermission(user, "support.manage") || roles.some((role) => ["support_manager", "support_agent"].includes(role));
}

async function participant(db, user, conversation) {
  if (supportStaff(user) || conversation.requesterId === user.uid) return { allowed: true, support: supportStaff(user), requester: conversation.requesterId === user.uid };
  if (conversation.businessId) {
    try {
      await requireBusinessPermission(db, user, conversation.businessId, "support.manage", { allowRoles: ["organization_owner", "business_owner", "business_manager"] });
      return { allowed: true, support: false, business: true };
    } catch {}
  }
  return { allowed: false, support: false, requester: false, business: false };
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();

    if (body.action === "create") {
      await enforceRateLimit(request, { key: `support-create:${user.uid}`, limit: 8, windowMs: 30 * 60_000 });
      const conversationRef = db.collection("supportConversations").doc();
      const messageRef = db.collection("supportMessages").doc();
      await db.runTransaction(async (transaction) => {
        transaction.create(conversationRef, {
          requesterId: user.uid,
          requesterEmail: user.email || body.email || "",
          requesterName: user.name || body.name || "Visitor",
          audience: body.audience,
          subject: safeText(body.subject, 180),
          category: safeText(body.category, 80),
          priority: body.priority,
          status: "open",
          businessId: body.businessId || null,
          contextType: body.contextType || null,
          contextId: body.contextId || null,
          context: body.context || null,
          assignedTo: null,
          lastMessage: safeText(body.message, 500),
          lastMessageAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(messageRef, {
          conversationId: conversationRef.id,
          senderId: user.uid,
          senderName: user.name || body.name || "Visitor",
          senderRole: body.audience,
          body: safeText(body.message, 6000),
          internal: false,
          createdAt: FieldValue.serverTimestamp()
        });
      });
      return Response.json({ ok: true, conversationId: conversationRef.id });
    }

    const conversationRef = db.collection("supportConversations").doc(body.conversationId);
    const snapshot = await conversationRef.get();
    if (!snapshot.exists) throw Object.assign(new Error("The support conversation was not found."), { status: 404 });
    const conversation = snapshot.data();
    const access = await participant(db, user, conversation);
    if (!access.allowed) throw Object.assign(new Error("You cannot access this support conversation."), { status: 403 });

    if (body.action === "message") {
      await enforceRateLimit(request, { key: `support-message:${user.uid}`, limit: 50, windowMs: 15 * 60_000 });
      if (body.internal && !access.support) throw Object.assign(new Error("Internal notes are restricted to Spotly support staff."), { status: 403 });
      const messageRef = db.collection("supportMessages").doc();
      await db.runTransaction(async (transaction) => {
        transaction.create(messageRef, {
          conversationId: body.conversationId,
          senderId: user.uid,
          senderName: user.name || body.senderName || (access.support ? "Spotly Support" : "Customer"),
          senderRole: access.support ? "support" : safeText(body.senderRole || "customer", 80),
          body: safeText(body.body, 6000),
          attachments: body.attachments,
          context: body.context || null,
          internal: Boolean(body.internal),
          createdAt: FieldValue.serverTimestamp()
        });
        transaction.set(conversationRef, {
          lastMessage: body.internal ? "Internal note" : safeText(body.body, 500),
          lastMessageAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          status: body.status || (access.support ? "waiting_for_user" : "waiting_for_spotly")
        }, { merge: true });
      });
      return Response.json({ ok: true, messageId: messageRef.id });
    }

    const patch = { updatedAt: FieldValue.serverTimestamp() };
    if (access.support) {
      if (body.status !== undefined) patch.status = body.status;
      if (body.assignedTo !== undefined) patch.assignedTo = body.assignedTo;
      if (body.priority !== undefined) patch.priority = body.priority;
      if (body.satisfaction !== undefined) patch.satisfaction = body.satisfaction;
    } else {
      if (body.assignedTo !== undefined || body.priority !== undefined) throw Object.assign(new Error("Assignment and priority are restricted to Spotly support staff."), { status: 403 });
      if (body.status !== undefined && !["open", "closed"].includes(body.status)) throw Object.assign(new Error("You can only close or reopen your conversation."), { status: 403 });
      if (body.status !== undefined) patch.status = body.status;
      if (body.satisfaction !== undefined) patch.satisfaction = body.satisfaction;
    }
    if (body.status === "closed") Object.assign(patch, { closedAt: FieldValue.serverTimestamp(), closedBy: user.uid });
    if (body.status === "open" && conversation.status === "closed") Object.assign(patch, { reopenedAt: FieldValue.serverTimestamp(), reopenedBy: user.uid });
    if (body.satisfaction !== undefined) Object.assign(patch, { satisfactionAt: FieldValue.serverTimestamp(), satisfactionBy: user.uid });
    await conversationRef.set(patch, { merge: true });
    return Response.json({ ok: true, conversationId: body.conversationId, status: patch.status || conversation.status });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the support details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
