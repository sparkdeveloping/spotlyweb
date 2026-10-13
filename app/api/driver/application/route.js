import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { applicationReadiness } from "@/lib/driver-delivery-server";
import { normalizeZimbabwePhone, safeText } from "@/lib/server-helpers";
import { accountLast4, encryptFinancialValue } from "@/lib/business-money-server";
import { notifyRoleAudience, notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["save", "submit", "document", "payout", "training"]),
  application: z.object({
    legalName: z.string().max(160).optional(), phone: z.string().max(40).optional(), city: z.string().max(80).optional(),
    preferredZones: z.array(z.string().max(100)).max(30).optional(), emergencyContactName: z.string().max(160).optional(), emergencyContactPhone: z.string().max(40).optional(),
    currentStep: z.number().int().min(0).max(8).optional(), agreementsAccepted: z.boolean().optional(), locationConsent: z.boolean().optional()
  }).optional(),
  vehicle: z.object({ type: z.enum(["motorcycle", "car", "van", "bicycle"]), registration: z.string().min(2).max(40), make: z.string().max(80).optional(), model: z.string().max(80).optional(), ownership: z.enum(["driver_owned", "fleet_owned", "rented"]).default("driver_owned") }).optional(),
  document: z.object({ type: z.enum(["identity", "licence", "registration", "insurance", "vehicle_fitness", "other"]), storagePath: z.string().min(3).max(500), fileName: z.string().max(180), expiresAt: z.string().nullable().optional() }).optional(),
  payout: z.object({ type: z.enum(["bank", "mobile_money"]), provider: z.string().min(2).max(80), recipientName: z.string().min(2).max(160), identifier: z.string().min(3).max(120) }).optional(),
  trainingComplete: z.boolean().optional()
});

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    const appRef = db.collection("driverApplications").doc(user.uid);
    const now = FieldValue.serverTimestamp();

    if (body.action === "save") {
      const values = body.application || {};
      await appRef.set({
        userId: user.uid,
        email: user.email || user.profile?.email || "",
        legalName: safeText(values.legalName || user.name || user.profile?.displayName || "", 160),
        phone: normalizeZimbabwePhone(values.phone || user.profile?.phoneNumber || ""),
        city: safeText(values.city || "Harare", 80),
        preferredZones: values.preferredZones || [],
        emergencyContactName: safeText(values.emergencyContactName, 160),
        emergencyContactPhone: normalizeZimbabwePhone(values.emergencyContactPhone || ""),
        currentStep: values.currentStep ?? 0,
        agreementsAccepted: Boolean(values.agreementsAccepted),
        locationConsent: Boolean(values.locationConsent),
        status: "application_started",
        updatedAt: now,
        createdAt: now
      }, { merge: true });
      if (body.vehicle) {
        await db.collection("driverVehicles").doc(`${user.uid}_primary`).set({ driverId: user.uid, ...body.vehicle, registration: safeText(body.vehicle.registration, 40).toUpperCase(), status: "pending_review", updatedAt: now, createdAt: now }, { merge: true });
      }
      return Response.json({ ok: true });
    }

    if (body.action === "document") {
      if (!body.document) throw Object.assign(new Error("Document details are required."), { status: 400 });
      const expectedPrefix = `driver-applications/${user.uid}/documents/`;
      if (!body.document.storagePath.startsWith(expectedPrefix)) throw Object.assign(new Error("That Driver document path is not allowed."), { status: 403 });
      const docRef = db.collection("driverDocuments").doc();
      await docRef.set({ driverId: user.uid, ...body.document, status: "uploaded", uploadedAt: now, updatedAt: now });
      await appRef.set({ status: "application_started", updatedAt: now }, { merge: true });
      return Response.json({ ok: true, documentId: docRef.id });
    }

    if (body.action === "payout") {
      if (!body.payout) throw Object.assign(new Error("Payout details are required."), { status: 400 });
      const existingPayout = await db.collection("driverPayoutAccounts").doc(user.uid).get();
      if (existingPayout.exists && existingPayout.data().verificationState === "verified") {
        const age = Math.floor(Date.now() / 1000) - Number(user.auth_time || 0);
        if (!user.auth_time || age > 15 * 60) throw Object.assign(new Error("Sign in again before changing a verified payout account."), { status: 401 });
      }
      const identifier = safeText(body.payout.identifier, 120);
      await db.collection("driverPayoutAccounts").doc(user.uid).set({
        driverId: user.uid, type: body.payout.type, provider: safeText(body.payout.provider, 80), recipientName: safeText(body.payout.recipientName, 160),
        identifierEncrypted: encryptFinancialValue(identifier), maskedIdentifier: `•••• ${accountLast4(identifier)}`, verificationState: "pending", updatedAt: now, createdAt: now
      }, { merge: true });
      await appRef.set({ payoutComplete: true, updatedAt: now }, { merge: true });
      await Promise.allSettled([
        notifyUser({ db, messaging, auth, userId: user.uid, title: "Payout details sent to Spotly", body: "Your payout destination is saved and waiting for verification.", href: "/profile", category: "driver_review", workspace: "driver", module: "money", eventType: "driver_payout_account.submitted", importance: "high", entityType: "driverPayoutAccount", entityId: user.uid, email: true, forceOperationalEmail: true }),
        notifyRoleAudience({ db, messaging, auth, title: "Driver payout account needs review", body: `${safeText(body.payout.recipientName, 160)} submitted Driver payout details for verification.`, href: `/admin/drivers?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "money", eventType: "driver_payout_account.submitted", importance: "high", entityType: "driverPayoutAccount", entityId: user.uid, email: true, forceOperationalEmail: true }, ["super_admin", "finance_admin", "operations_manager"])
      ]);
      return Response.json({ ok: true });
    }

    if (body.action === "training") {
      await appRef.set({ trainingComplete: body.trainingComplete !== false, updatedAt: now }, { merge: true });
      return Response.json({ ok: true });
    }

    const [appSnap, vehicleQuery, documentQuery] = await Promise.all([
      appRef.get(), db.collection("driverVehicles").where("driverId", "==", user.uid).limit(5).get(), db.collection("driverDocuments").where("driverId", "==", user.uid).limit(30).get()
    ]);
    if (!appSnap.exists) throw Object.assign(new Error("Complete your Driver application before submitting."), { status: 409 });
    const readiness = applicationReadiness(appSnap.data(), vehicleQuery.docs[0]?.data() || null, documentQuery.docs.map((item) => item.data()));
    if (!readiness.complete) throw Object.assign(new Error("Complete every Driver application step before submitting."), { status: 409, blockers: readiness.checks.filter((item) => !item.ok) });
    await appRef.set({ status: "application_submitted", submittedAt: now, updatedAt: now }, { merge: true });
    await db.collection("adminQueueItems").doc(`driver_application_${user.uid}`).set({
      queue: "driver-applications", type: "driver_application", entityId: user.uid, driverId: user.uid, status: "open", priority: "normal", title: safeText(appSnap.data().legalName || user.name || "Driver application", 160), createdAt: now, updatedAt: now
    }, { merge: true });
    const driverName = safeText(appSnap.data().legalName || user.name || "Driver", 160);
    await Promise.allSettled([
      notifyUser({ db, messaging, auth, userId: user.uid, title: "Driver application sent to Spotly", body: "Your application is saved and waiting for review. We will notify you here and by email when anything changes.", href: "/", category: "driver_review", workspace: "driver", module: "reviews", eventType: "driver_application.submitted", importance: "high", entityType: "driverApplication", entityId: user.uid, email: true, forceOperationalEmail: true }),
      notifyRoleAudience({ db, messaging, auth, title: `Driver application ready · ${driverName}`, body: "A Driver completed the application and is ready for document and eligibility review.", href: `/admin/drivers?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "reviews", eventType: "driver_application.submitted", importance: "high", entityType: "driverApplication", entityId: user.uid, email: true, forceOperationalEmail: true }, ["super_admin", "driver_operations_coordinator", "operations_manager", "risk_compliance_officer"])
    ]);
    return Response.json({ ok: true, status: "application_submitted" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Driver application details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
