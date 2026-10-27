import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
const schema = z.object({ entryId: z.string().regex(/^[a-f0-9]{40}$/),
  channel: z.enum(["call", "email", "whatsapp", "meeting", "note"]),
  outcome: z.enum(["attempted", "connected", "interested", "follow_up", "no_response", "not_interested"]),
  note: z.string().trim().min(1).max(1000), nextFollowup: z.string().datetime().nullable().optional() }).strict();
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "launch.read");
    const entryId = new URL(request.url).searchParams.get("entryId") || "";
    if (!/^[a-f0-9]{40}$/.test(entryId)) return Response.json({ error: "Invalid registration." }, { status: 400 });
    const { db } = getAdminServices();
    const doc = await db.collection("waitlistEntries").doc(entryId).get();
    if (!doc.exists) return Response.json({ error: "Registration not found." }, { status: 404 });
    const snapshot = await db.collection("firstAccessTouchpoints").where("entryId", "==", entryId).orderBy("createdAt", "desc").limit(60).get();
    return Response.json({ ok: true, items: snapshot.docs.map((item) => ({ id: item.id, ...item.data(), createdAt: item.data().createdAt?.toDate?.()?.toISOString() || null })) }, { headers });
  } catch (error) { return apiError(error); }
}
export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "launch.manage");
    const data = schema.parse(await request.json());
    const { db } = getAdminServices();
    const entry = db.collection("waitlistEntries").doc(data.entryId);
    const nextFollowupAt = data.nextFollowup ? new Date(data.nextFollowup) : null;
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(entry);
      if (!existing.exists) throw Object.assign(new Error("Registration not found."), { status: 404 });
      tx.create(db.collection("firstAccessTouchpoints").doc(), { ...data, actorId: actor.uid, actorEmail: actor.email || "", createdAt: FieldValue.serverTimestamp() });
      tx.update(entry, { lastContactChannel: data.channel, lastContactOutcome: data.outcome, lastContactAt: FieldValue.serverTimestamp(),
        ...(nextFollowupAt ? { nextFollowupAt } : {}), updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid });
      tx.create(db.collection("auditLogs").doc(), { action: "first_access.touchpoint_created", entityType: "waitlistEntry", entityId: data.entryId,
        actorId: actor.uid, actorEmail: actor.email || "", metadata: { channel: data.channel, outcome: data.outcome }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the contact activity." }, { status: 400 });
    return apiError(error);
  }
}
