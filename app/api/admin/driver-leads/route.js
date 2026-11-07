import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { canManageDriverLeads, cleanLead, contactKey, driverLeadInvitationUrl, issueDriverLeadToken, leadPublicData } from "@/lib/driver-leads";

export const runtime = "nodejs";
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), lead: z.unknown() }),
  z.object({ action: z.literal("update"), leadId: z.string().min(1).max(180), lead: z.unknown() }),
  z.object({ action: z.literal("invite"), leadId: z.string().min(1).max(180) }),
  z.object({ action: z.literal("archive"), leadId: z.string().min(1).max(180), reason: z.string().trim().min(3).max(500) })
]);
function deny() { throw Object.assign(new Error("You cannot manage prospective Driver profiles."), { status: 403 }); }
function audit(db, tx, actor, action, id, meta = {}) {
  tx.create(db.collection("auditLogs").doc(), { action, entityType: "driverLead", entityId: id, actorId: actor.uid, actorEmail: actor.email || "", metadata: meta, createdAt: FieldValue.serverTimestamp() });
}
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!canManageDriverLeads(actor.profile)) deny();
    const { db } = getAdminServices();
    const snap = await db.collection("driverLeads").orderBy("createdAt", "desc").limit(250).get();
    return Response.json({ ok: true, leads: snap.docs.map((item) => leadPublicData(item.data(), item.id)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!canManageDriverLeads(actor.profile)) deny();
    const body = mutation.parse(await request.json());
    const { db, auth } = getAdminServices();
    if (body.action === "create") {
      const lead = cleanLead(body.lead);
      if (lead.email) {
        try {
          const existing = await auth.getUserByEmail(lead.email);
          if ((await db.collection("driverApplications").doc(existing.uid).get()).exists) throw Object.assign(new Error("This email already has a Driver application. Open the existing Driver in Admin."), { status: 409 });
        } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
      }
      const ref = db.collection("driverLeads").doc();
      const invitation = issueDriverLeadToken();
      await db.runTransaction(async (tx) => {
        const keys = [lead.email && contactKey("email", lead.email), lead.phone && contactKey("phone", lead.phone)].filter(Boolean);
        const refs = keys.map((key) => db.collection("driverLeadContacts").doc(key));
        const snaps = await Promise.all(refs.map((r) => tx.get(r)));
        if (snaps.some((s) => s.exists)) throw Object.assign(new Error("A prospective Driver already uses this email or phone. Find that profile instead of creating a duplicate."), { status: 409 });
        tx.create(ref, { ...lead, status: "awaiting_claim", invitationHash: invitation.tokenHash, invitationExpiresAt: invitation.invitationExpiresAt, assignedTo: actor.uid, createdBy: actor.uid, lastEditedBy: actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        refs.forEach((r) => tx.create(r, { leadId: ref.id, createdAt: FieldValue.serverTimestamp() }));
        audit(db, tx, actor, "driver_lead.created", ref.id, { country: lead.country, vehicleType: lead.vehicleType });
      });
      return Response.json({ ok: true, leadId: ref.id, invitationUrl: driverLeadInvitationUrl(invitation.token) });
    }
    const ref = db.collection("driverLeads").doc(body.leadId);
    if (body.action === "update") {
      const next = cleanLead(body.lead);
      if (next.email) {
        try {
          const existing = await auth.getUserByEmail(next.email);
          if ((await db.collection("driverApplications").doc(existing.uid).get()).exists) throw Object.assign(new Error("This email already belongs to a Driver application. Open that Driver instead."), { status: 409 });
        } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
      }
      // A correction to an email or phone invalidates the previously shared invitation.
      // Contact indexes change atomically so another officer cannot create a duplicate.
      let nextInvitation = null;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw Object.assign(new Error("Prospective Driver not found."), { status: 404 });
        const old = snap.data();
        if (old.status !== "awaiting_claim") throw Object.assign(new Error("This profile is claimed or archived and cannot be edited here."), { status: 409 });
        const changed = next.email !== old.email || next.phone !== old.phone;
        const oldKeys = [old.email && contactKey("email", old.email), old.phone && contactKey("phone", old.phone)].filter(Boolean);
        const nextKeys = [next.email && contactKey("email", next.email), next.phone && contactKey("phone", next.phone)].filter(Boolean);
        const additions = nextKeys.filter((key) => !oldKeys.includes(key));
        const addedRefs = additions.map((key) => db.collection("driverLeadContacts").doc(key));
        const collisions = await Promise.all(addedRefs.map((contact) => tx.get(contact)));
        if (collisions.some((item) => item.exists)) throw Object.assign(new Error("This email or phone is already attached to another prospective Driver."), { status: 409 });
        nextInvitation = changed ? issueDriverLeadToken() : null;
        tx.update(ref, { ...next, ...(nextInvitation ? { invitationHash: nextInvitation.tokenHash, invitationExpiresAt: nextInvitation.invitationExpiresAt } : {}), lastEditedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
        oldKeys.filter((key) => !nextKeys.includes(key)).forEach((key) => tx.delete(db.collection("driverLeadContacts").doc(key)));
        addedRefs.forEach((contact) => tx.create(contact, { leadId: ref.id, createdAt: FieldValue.serverTimestamp() }));
        audit(db, tx, actor, changed ? "driver_lead.contact_corrected" : "driver_lead.updated", ref.id, { contactCorrected: changed });
      });
      return Response.json({ ok: true, ...(nextInvitation ? { invitationUrl: driverLeadInvitationUrl(nextInvitation.token) } : {}) });
    }
    if (body.action === "invite") {
      const invitation = issueDriverLeadToken();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw Object.assign(new Error("Prospective Driver not found."), { status: 404 });
        if (snap.data().status !== "awaiting_claim") throw Object.assign(new Error("Only unclaimed profiles can be invited."), { status: 409 });
        tx.update(ref, { invitationHash: invitation.tokenHash, invitationExpiresAt: invitation.invitationExpiresAt, invitedBy: actor.uid, invitedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        audit(db, tx, actor, "driver_lead.invitation_rotated", ref.id);
      });
      return Response.json({ ok: true, invitationUrl: driverLeadInvitationUrl(invitation.token) });
    }
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error("Prospective Driver not found."), { status: 404 });
      const lead = snap.data();
      if (lead.status !== "awaiting_claim") throw Object.assign(new Error("A claimed profile cannot be archived here."), { status: 409 });
      const keys = [lead.email && contactKey("email", lead.email), lead.phone && contactKey("phone", lead.phone)].filter(Boolean);
      tx.update(ref, { status: "archived", invitationHash: FieldValue.delete(), invitationExpiresAt: null, archivedBy: actor.uid, archiveReason: body.reason, updatedAt: FieldValue.serverTimestamp() });
      keys.forEach((key) => tx.delete(db.collection("driverLeadContacts").doc(key)));
      audit(db, tx, actor, "driver_lead.archived", ref.id, { reason: body.reason });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Driver profile fields.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
