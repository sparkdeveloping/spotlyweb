import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { authorizedClaim, tokenHash } from "@/lib/driver-leads";

export const runtime = "nodejs";
const schema = z.object({ token: z.string().min(32).max(120) });
export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (user.firebase?.sign_in_provider === "anonymous") throw Object.assign(new Error("Sign in using your verified email or phone to continue."), { status: 403 });
    const { token } = schema.parse(await request.json());
    const { db } = getAdminServices();
    const matches = await db.collection("driverLeads").where("invitationHash", "==", tokenHash(token)).limit(1).get();
    if (matches.empty) throw Object.assign(new Error("This invitation is invalid, replaced or no longer available. Ask Spotly to send a new link."), { status: 404 });
    const leadRef = matches.docs[0].ref;
    const appRef = db.collection("driverApplications").doc(user.uid);
    const vehicleRef = db.collection("driverVehicles").doc(`${user.uid}_primary`);
    await db.runTransaction(async (tx) => {
      const [leadSnap, applicationSnap, vehicleSnap] = await Promise.all([tx.get(leadRef), tx.get(appRef), tx.get(vehicleRef)]);
      const lead = leadSnap.data();
      const expiry = Date.parse(lead?.invitationExpiresAt || "");
      if (!lead || lead.status !== "awaiting_claim" || lead.invitationHash !== tokenHash(token) || !Number.isFinite(expiry) || expiry <= Date.now()) throw Object.assign(new Error("This invitation has expired or was already used. Ask Spotly for another link."), { status: 409 });
      if (!authorizedClaim(user, lead)) throw Object.assign(new Error("Sign in with the verified email address or verified phone number that Spotly recorded for you."), { status: 403 });
      if (applicationSnap.exists && applicationSnap.data()?.sourceLeadId && applicationSnap.data()?.sourceLeadId !== leadRef.id) throw Object.assign(new Error("This account has a different Driver application. Contact Spotly to combine records safely."), { status: 409 });
      if (applicationSnap.exists && ["application_submitted", "under_review", "approved", "ready", "active"].includes(applicationSnap.data()?.status)) throw Object.assign(new Error("Your Driver application has already been submitted. Open your Driver workspace."), { status: 409 });
      if (vehicleSnap.exists && vehicleSnap.data()?.driverId !== user.uid) throw Object.assign(new Error("Vehicle ownership conflict."), { status: 409 });
      const now = FieldValue.serverTimestamp();
      const current = applicationSnap.data() || {};
      const app = { userId: user.uid, sourceLeadId: leadRef.id, status: current.status || "application_started", email: user.email || lead.email || "", legalName: current.legalName || lead.legalName,
        phone: current.phone || lead.phone || "", licenceReference: current.licenceReference || lead.licenceReference || "", country: current.country || lead.country, countrySource: current.countryOverride ? "admin_override" : "staff_onboarding", city: current.city || lead.city || "",
        preferredZones: current.preferredZones?.length ? current.preferredZones : lead.preferredZones || [],
        requestedCapabilities: current.requestedCapabilities?.length ? current.requestedCapabilities : lead.requestedCapabilities || [],
        currentStep: Number.isInteger(current.currentStep) ? current.currentStep : 0, updatedAt: now };
      if (!applicationSnap.exists) app.createdAt = now;
      // No staff member can accept operating terms/location consent on a Driver's behalf.
      tx.set(appRef, app, { merge: true });
      if (!vehicleSnap.exists && lead.vehicleType) tx.create(vehicleRef, { driverId: user.uid, type: lead.vehicleType, make: lead.vehicleMake, model: lead.vehicleModel, registration: lead.vehicleRegistration, ownership: "driver_owned", requestedCapabilities: lead.requestedCapabilities || [], status: "setup_required", setupComplete: false, createdAt: now, updatedAt: now });
      tx.update(leadRef, { status: "claimed", claimedBy: user.uid, claimedAt: now, invitationHash: FieldValue.delete(), invitationExpiresAt: null, updatedAt: now });
      tx.create(db.collection("auditLogs").doc(), { action: "driver_lead.claimed", entityType: "driverLead", entityId: leadRef.id, actorId: user.uid, metadata: { driverId: user.uid }, createdAt: now });
    });
    return Response.json({ ok: true, redirectTo: "/" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The invitation link is invalid." }, { status: 400 });
    return apiError(error);
  }
}
