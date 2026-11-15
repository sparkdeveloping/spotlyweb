import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
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
    context: z.record(z.string(), z.unknown()).nullable().optional(),
    incidentReference: z.string().regex(/^SI-[0-9A-F]{12}$/).optional()
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
    action: z.literal("request_callback"),
    conversationId: z.string().min(3).max(180),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/),
    consent: z.literal(true)
  }),
  z.object({
    action: z.literal("callback_review"),
    conversationId: z.string().min(3).max(180),
    status: z.enum(["contacting", "completed", "unable_to_reach", "declined"])
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

function publicSupportRecord(id, data = {}) {
  const iso = (value) => value?.toDate?.().toISOString?.() || null;
  return {
    id,
    subject: data.subject || "Spotly Support",
    category: data.category || "general",
    priority: data.priority || "normal",
    status: data.status || "open",
    contextType: data.contextType || null,
    contextId: data.contextId || null,
    lastMessage: data.lastMessage || "",
    unreadForRequester: Number(data.unreadForRequester || 0),
    callbackStatus: data.callbackRequest?.status || null,
    incidentReference: data.reportedIncidentReference || null,
    lastMessageAt: iso(data.lastMessageAt),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt)
  };
}

function publicSupportMessage(id, data = {}) {
  return {
    id,
    senderName: data.senderName || "Spotly Support",
    senderRole: data.senderRole || "support",
    body: data.body || "",
    createdAt: data.createdAt?.toDate?.().toISOString?.() || null
  };
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


export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: `support-read:${user.uid}`, limit: 120, windowMs: 60_000 });
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const conversationId = safeText(url.searchParams.get("conversationId") || "", 180);

    if (conversationId) {
      const snapshot = await db.collection("supportConversations").doc(conversationId).get();
      if (!snapshot.exists) throw Object.assign(new Error("The support conversation was not found."), { status: 404 });
      const conversation = snapshot.data() || {};
      const access = await participant(db, user, conversation);
      if (!access.allowed) throw Object.assign(new Error("You cannot access this support conversation."), { status: 403 });
      // Cheap foreground heartbeat: 1 conversation read, no message scan or unread write.
      // Used by tickets portal to detect a change before loading up to 250 messages.
      if (url.searchParams.get("metadataOnly") === "1") {
        return Response.json({ ok: true, conversation: publicSupportRecord(snapshot.id, conversation) }, { headers: { "Cache-Control": "no-store" } });
      }
      const messageSnapshot = await db.collection("supportMessages")
        .where("conversationId", "==", conversationId)
        .limit(250)
        .get();
      const messages = messageSnapshot.docs
        .map((doc) => ({ raw: doc.data() || {}, public: publicSupportMessage(doc.id, doc.data() || {}) }))
        .filter((message) => access.support || message.raw.internal !== true)
        .sort((a, b) => (a.raw.createdAt?.toMillis?.() || 0) - (b.raw.createdAt?.toMillis?.() || 0))
        .map((message) => message.public);
      if (access.requester && Number(conversation.unreadForRequester || 0) > 0) {
        await snapshot.ref.set({ unreadForRequester: 0, requesterLastReadAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      return Response.json({ ok: true, conversation: publicSupportRecord(snapshot.id, conversation), messages });
    }

    // Customer-facing support history is deliberately scoped to the requester.
    // Staff/business consoles have separate permissioned surfaces.
    const history = await db.collection("supportConversations")
      .where("requesterId", "==", user.uid)
      .limit(100)
      .get();
    const conversations = history.docs
      .map((doc) => ({ raw: doc.data() || {}, public: publicSupportRecord(doc.id, doc.data() || {}) }))
      .sort((a, b) => (b.raw.lastMessageAt?.toMillis?.() || b.raw.updatedAt?.toMillis?.() || 0) - (a.raw.lastMessageAt?.toMillis?.() || a.raw.updatedAt?.toMillis?.() || 0))
      .map((item) => item.public);
    return Response.json({ ok: true, conversations });
  } catch (error) {
    return apiError(error, "Support history could not be loaded.");
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();

    if (body.action === "create") {
      await enforceRateLimit(request, { key: `support-create:${user.uid}`, limit: 8, windowMs: 30 * 60_000 });
      if (user?.firebase?.sign_in_provider === "anonymous") {
        // An IP/network quota limits disposable anonymous UIDs without making
        // shared mobile networks too restrictive. App Check can be required
        // after the staging challenge has been tested on every workspace.
        if (process.env.SPOTLY_SUPPORT_ANONYMOUS_APP_CHECK_REQUIRED === "true") {
          await verifyAppCheckRequest(request, { required: true });
        }
        await enforceRateLimit(request, { key: "support-create-guest-network", limit: 100, windowMs: 60 * 60_000 });
      }
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
          reportedIncidentReference: body.incidentReference || null,
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
      // A crash reference is a lookup hint, not proof of requester identity.
      // Link only an existing and unlinked incident, without disclosing its internals.
      if (body.incidentReference) {
        try {
          const incidentRef = db.collection("clientIncidents").doc(body.incidentReference);
          await db.runTransaction(async (tx) => {
            const incident = await tx.get(incidentRef);
            if (incident.exists && !incident.data()?.linkedConversationId) {
              tx.set(incidentRef, {
                linkedConversationId: conversationRef.id,
                linkedAt: FieldValue.serverTimestamp(),
                status: "linked"
              }, { merge: true });
            }
          });
        } catch (incidentLinkError) {
          console.warn("support_incident_reference_unlinked", incidentLinkError?.code || "unavailable");
        }
      }
      notifyRoleAudience({ db, messaging, auth, title: "New support conversation", body: safeText(body.subject, 180), href: "/work?view=support", workspace: "admin", module: "support", eventType: "support.conversation.created", entityType: "support_conversation", entityId: conversationRef.id, push: true }, ["support_agent", "support_manager"]).catch(() => null);
      return Response.json({ ok: true, conversationId: conversationRef.id });
    }

    const conversationRef = db.collection("supportConversations").doc(body.conversationId);
    const snapshot = await conversationRef.get();
    if (!snapshot.exists) throw Object.assign(new Error("The support conversation was not found."), { status: 404 });
    const conversation = snapshot.data();
    const access = await participant(db, user, conversation);
    if (!access.allowed) throw Object.assign(new Error("You cannot access this support conversation."), { status: 403 });

    if (body.action === "request_callback") {
      if (!access.requester) throw Object.assign(new Error("Only the person who opened this case can request a callback."), { status: 403 });
      await enforceRateLimit(request, { key: `support-callback:${user.uid}`, limit: 3, windowMs: 60 * 60_000 });
      if (["requested", "contacting"].includes(conversation.callbackRequest?.status)) {
        return Response.json({ ok: true, callbackStatus: conversation.callbackRequest.status }, { headers: { "Cache-Control": "no-store" } });
      }
      // Consent is explicit. Do not place telephone numbers into notification bodies or logs.
      await conversationRef.set({
        callbackRequest: {
          phone: body.phone.trim(), status: "requested", consentedBy: user.uid,
          consentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
        },
        unreadForSupport: FieldValue.increment(1), status: "waiting_for_spotly", updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return Response.json({ ok: true, callbackStatus: "requested" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "callback_review") {
      if (!access.support || !supportResponder(user)) throw Object.assign(new Error("Support response access is required."), { status: 403 });
      if (!conversation.callbackRequest?.consentedBy) throw Object.assign(new Error("No callback was requested."), { status: 400 });
      await conversationRef.update({ "callbackRequest.status": body.status, "callbackRequest.updatedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await supportAudit(db, user, body.conversationId, "support.callback.reviewed", { status: body.status });
      return Response.json({ ok: true, callbackStatus: body.status });
    }
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
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the support request details." }, { status: 400 });
    return apiError(error, "The support conversation could not be updated.");
  }
}
