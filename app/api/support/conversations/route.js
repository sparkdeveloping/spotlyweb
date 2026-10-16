import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { hasPlatformPermission, isPlatformAdmin, requireBusinessPermission } from "@/lib/access-control-server";
import { safeText } from "@/lib/server-helpers";
import { notifyUser, notifyRoleAudience } from "@/lib/notification-server";

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
    assignedToName: z.string().max(160).nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    satisfaction: z.number().int().min(1).max(5).optional(),
    markRead: z.boolean().optional()
  })
]);

function roles(user) {
  return Array.isArray(user?.profile?.roles) ? user.profile.roles : [];
}

function supportStaff(user) {
  return isPlatformAdmin(user) || hasPlatformPermission(user, "support.read") || hasPlatformPermission(user, "support.respond") || hasPlatformPermission(user, "support.manage") || roles(user).some((role) => ["support_manager", "support_agent"].includes(role));
}

function supportResponder(user) {
  return isPlatformAdmin(user) || hasPlatformPermission(user, "support.respond") || hasPlatformPermission(user, "support.manage") || roles(user).some((role) => ["support_manager", "support_agent"].includes(role));
}

function supportManager(user) {
  return isPlatformAdmin(user) || hasPlatformPermission(user, "support.manage") || roles(user).some((role) => ["support_manager", "operations_manager", "regional_operations_manager"].includes(role));
}

function actorName(user) {
  return safeText(user?.profile?.displayName || user?.name || user?.email || "Spotly Support", 160);
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

async function supportAudit(db, user, conversationId, action, details = {}) {
  await db.collection("auditLogs").add({
    action,
    entityType: "support_conversation",
    entityId: conversationId,
    actorId: user.uid,
    actorEmail: user.email || null,
    details,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();

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
          assignedToName: null,
          unreadForSupport: 1,
          unreadForRequester: 0,
          lastPublicMessageSender: "requester",
          lastMessage: safeText(body.message, 500),
          lastMessageAt: FieldValue.serverTimestamp(),
          requesterLastReadAt: FieldValue.serverTimestamp(),
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
      notifyRoleAudience({ db, messaging, auth, title: "New support conversation", body: safeText(body.subject, 180), href: "/work?view=support", workspace: "admin", module: "support", eventType: "support.conversation.created", entityType: "support_conversation", entityId: conversationRef.id, push: true }, ["support_agent", "support_manager"]).catch(() => null);
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
      if (access.support && !supportResponder(user)) throw Object.assign(new Error("Your support access is read-only."), { status: 403 });
      if (body.internal && !access.support) throw Object.assign(new Error("Internal notes are restricted to Spotly support staff."), { status: 403 });
      const messageRef = db.collection("supportMessages").doc();
      await db.runTransaction(async (transaction) => {
        const now = FieldValue.serverTimestamp();
        transaction.create(messageRef, {
          conversationId: body.conversationId,
          senderId: user.uid,
          senderName: access.support ? actorName(user) : (user.name || body.senderName || "Customer"),
          senderRole: access.support ? "support" : safeText(body.senderRole || "customer", 80),
          body: safeText(body.body, 6000),
          attachments: body.attachments,
          context: body.context || null,
          internal: Boolean(body.internal),
          createdAt: now
        });

        const patch = { updatedAt: now };
        if (body.internal) {
          patch.lastInternalNoteAt = now;
        } else {
          patch.lastMessage = safeText(body.body, 500);
          patch.lastMessageAt = now;
          patch.lastPublicMessageSender = access.support ? "support" : "requester";
          if (access.support) {
            patch.status = body.status || "waiting_for_user";
            patch.unreadForRequester = FieldValue.increment(1);
            patch.unreadForSupport = 0;
            patch.supportLastReadAt = now;
          } else {
            patch.status = body.status || "waiting_for_spotly";
            patch.unreadForSupport = FieldValue.increment(1);
            patch.unreadForRequester = 0;
            patch.requesterLastReadAt = now;
          }
        }
        transaction.set(conversationRef, patch, { merge: true });
      });

      if (!body.internal && access.support && conversation.requesterId) {
        notifyUser({
          db, messaging, auth,
          userId: conversation.requesterId,
          title: "Spotly Support replied",
          body: safeText(body.body, 240),
          href: `/support?conversation=${encodeURIComponent(body.conversationId)}`,
          workspace: "customer",
          category: "support",
          module: "support",
          eventType: "support.reply",
          entityType: "support_conversation",
          entityId: body.conversationId,
          email: false,
          push: true
        }).catch(() => null);
      } else if (!body.internal && !access.support && conversation.assignedTo) {
        notifyUser({
          db, messaging, auth,
          userId: conversation.assignedTo,
          title: "New support reply",
          body: safeText(body.body, 240),
          href: `/work?view=support&conversation=${encodeURIComponent(body.conversationId)}`,
          workspace: "admin",
          category: "support",
          module: "support",
          eventType: "support.customer_reply",
          entityType: "support_conversation",
          entityId: body.conversationId,
          push: true
        }).catch(() => null);
      }
      return Response.json({ ok: true, messageId: messageRef.id });
    }

    const patch = { updatedAt: FieldValue.serverTimestamp() };
    const changes = {};
    if (access.support) {
      if (body.status !== undefined) {
        if (!supportResponder(user)) throw Object.assign(new Error("Your support access is read-only."), { status: 403 });
        patch.status = body.status;
        changes.status = body.status;
        if (["resolved", "closed"].includes(body.status)) patch.resolvedAt = FieldValue.serverTimestamp();
        if (body.status === "open") patch.reopenedAt = FieldValue.serverTimestamp();
      }
      if (body.assignedTo !== undefined) {
        if (body.assignedTo && body.assignedTo !== user.uid && !supportManager(user)) throw Object.assign(new Error("Only support managers can assign conversations to another agent."), { status: 403 });
        if (!supportResponder(user)) throw Object.assign(new Error("Your support access is read-only."), { status: 403 });
        patch.assignedTo = body.assignedTo;
        patch.assignedToName = body.assignedTo ? (body.assignedTo === user.uid ? actorName(user) : safeText(body.assignedToName || "Assigned agent", 160)) : null;
        if (body.assignedTo && ["open", "waiting_for_spotly"].includes(conversation.status)) patch.status = "assigned";
        changes.assignedTo = body.assignedTo || null;
      }
      if (body.priority !== undefined) {
        if (!supportResponder(user)) throw Object.assign(new Error("Your support access is read-only."), { status: 403 });
        patch.priority = body.priority;
        changes.priority = body.priority;
      }
      if (body.markRead) {
        patch.unreadForSupport = 0;
        patch.supportLastReadAt = FieldValue.serverTimestamp();
      }
    } else {
      if (body.status === "closed" || body.status === "open") patch.status = body.status;
      if (body.satisfaction !== undefined) patch.satisfaction = body.satisfaction;
      if (body.markRead) {
        patch.unreadForRequester = 0;
        patch.requesterLastReadAt = FieldValue.serverTimestamp();
      }
    }
    await conversationRef.set(patch, { merge: true });
    if (access.support && Object.keys(changes).length) await supportAudit(db, user, body.conversationId, "support.conversation.updated", changes);
    return Response.json({ ok: true, conversationId: body.conversationId, status: patch.status || conversation.status });
  } catch (error) {
    return apiError(error, "The support conversation could not be updated.");
  }
}
