import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
const schema = z.object({ incidentId: z.string().regex(/^SI-[0-9A-F]{12}$/) });

/** One permissioned, internal-only support case per automatic incident. */
export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "support.respond", { roles: ["support_agent", "support_manager"] });
    const { incidentId } = schema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("clientIncidents").doc(incidentId);
    const caseRef = db.collection("supportConversations").doc();
    const messageRef = db.collection("supportMessages").doc();
    const conversationId = await db.runTransaction(async (tx) => {
      const incident = await tx.get(ref);
      if (!incident.exists) throw Object.assign(new Error("This incident is not available."), { status: 404 });
      const record = incident.data() || {};
      if (record.linkedConversationId) return record.linkedConversationId;
      const summary = `App incident ${incidentId} · ${String(record.platform || "web").slice(0, 30)} · ${String(record.screen || "/").slice(0, 80)}`;
      tx.create(caseRef, {
        requesterId: null, requesterEmail: "", requesterName: "Spotly monitoring",
        audience: "staff", subject: summary.slice(0, 180), category: "app_incident", priority: record.severity === "critical" ? "urgent" : "high",
        status: "escalated", internalOnly: true, reportedIncidentReference: incidentId,
        assignedTo: null, assignedToName: null, unreadForSupport: 1, unreadForRequester: 0,
        contextType: "client_incident", contextId: incidentId,
        lastMessage: "Internal incident review needed", lastPublicMessageSender: "system",
        lastMessageAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      });
      tx.create(messageRef, {
        conversationId: caseRef.id, senderId: user.uid, senderName: "Spotly monitoring",
        senderRole: "support", body: summary, internal: true,
        createdAt: FieldValue.serverTimestamp()
      });
      tx.set(ref, { linkedConversationId: caseRef.id, linkedAt: FieldValue.serverTimestamp(), status: "escalated" }, { merge: true });
      return caseRef.id;
    });
    return Response.json({ ok: true, conversationId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Enter a valid incident reference." }, { status: 400 });
    return apiError(error);
  }
}
