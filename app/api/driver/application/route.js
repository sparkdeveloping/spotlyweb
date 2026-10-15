import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { applicationReadiness } from "@/lib/driver-delivery-server";
import { DRIVER_CAPABILITIES, DRIVER_TRAINING_MODULES, normalizeCapabilities, trainingModuleIsCurrent, trainingRequirementsFor } from "@/lib/driver-capabilities";
import { normalizeZimbabwePhone, safeText } from "@/lib/server-helpers";
import { accountLast4, encryptFinancialValue } from "@/lib/business-money-server";
import { notifyRoleAudience, notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["save", "submit", "vehicle", "document", "payout", "training"]),
  application: z.object({
    legalName: z.string().max(160).optional(), phone: z.string().max(40).optional(), city: z.string().max(80).optional(),
    preferredZones: z.array(z.string().max(100)).max(30).optional(), emergencyContactName: z.string().max(160).optional(), emergencyContactPhone: z.string().max(40).optional(),
    requestedCapabilities: z.array(z.enum(Object.keys(DRIVER_CAPABILITIES))).max(8).optional(),
    currentStep: z.number().int().min(0).max(10).optional(), agreementsAccepted: z.boolean().optional(), locationConsent: z.boolean().optional()
  }).optional(),
  vehicle: z.object({ type: z.enum(["motorcycle", "car", "van", "bicycle"]), registration: z.string().max(40).optional().default(""), make: z.string().max(80).optional(), model: z.string().max(80).optional(), ownership: z.enum(["driver_owned", "fleet_owned", "rented"]).default("driver_owned") }).optional(),
  document: z.object({ type: z.enum(["identity", "licence", "registration", "insurance", "vehicle_fitness", "other"]), storagePath: z.string().min(3).max(500), fileName: z.string().max(180), expiresAt: z.string().nullable().optional() }).optional(),
  payout: z.object({ type: z.enum(["bank", "mobile_money"]), provider: z.string().min(2).max(80), recipientName: z.string().min(2).max(160), identifier: z.string().min(3).max(120) }).optional(),
  trainingComplete: z.boolean().optional(),
  trainingModuleId: z.enum(Object.keys(DRIVER_TRAINING_MODULES)).optional(),
  trainingAnswer: z.number().int().min(0).max(8).optional()
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
      const vehicleType = body.vehicle?.type || null;
      const requestedCapabilities = normalizeCapabilities(values.requestedCapabilities || [], vehicleType || "").filter((capabilityId) => !vehicleType || DRIVER_CAPABILITIES[capabilityId]?.vehicleTypes?.includes(vehicleType));
      if (body.vehicle && body.vehicle.type !== "bicycle" && safeText(body.vehicle.registration || "", 40).length < 2) throw Object.assign(new Error("Add the motor vehicle registration before continuing."), { status: 400 });
      await appRef.set({
        userId: user.uid,
        email: user.email || user.profile?.email || "",
        legalName: safeText(values.legalName || user.name || user.profile?.displayName || "", 160),
        phone: normalizeZimbabwePhone(values.phone || user.profile?.phoneNumber || ""),
        city: safeText(values.city || "Harare", 80),
        preferredZones: values.preferredZones || [],
        requestedCapabilities,
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
        await db.collection("driverVehicles").doc(`${user.uid}_primary`).set({ driverId: user.uid, ...body.vehicle, registration: body.vehicle.type === "bicycle" ? "" : safeText(body.vehicle.registration || "", 40).toUpperCase(), status: "pending_review", updatedAt: now, createdAt: now }, { merge: true });
      }
      return Response.json({ ok: true });
    }

    if (body.action === "vehicle") {
      if (!body.vehicle) throw Object.assign(new Error("Vehicle details are required."), { status: 400 });
      const driverSnap = await db.collection("drivers").doc(user.uid).get();
      if (!driverSnap.exists || !["approved", "ready", "active", "temporarily_unavailable", "suspended"].includes(driverSnap.data()?.status)) throw Object.assign(new Error("Finish Driver activation before adding another vehicle here."), { status: 409 });
      if (body.vehicle.type !== "bicycle" && safeText(body.vehicle.registration || "", 40).length < 2) throw Object.assign(new Error("Add the motor vehicle registration."), { status: 400 });
      const vehicleRef = db.collection("driverVehicles").doc();
      await vehicleRef.set({ driverId: user.uid, ...body.vehicle, registration: body.vehicle.type === "bicycle" ? "" : safeText(body.vehicle.registration || "", 40).toUpperCase(), status: "pending_review", submittedAt: now, updatedAt: now, createdAt: now });
      await db.collection("adminQueueItems").doc(`driver_vehicle_${vehicleRef.id}`).set({ queue: "driver-vehicles", type: "driver_vehicle_review", entityId: vehicleRef.id, driverId: user.uid, vehicleId: vehicleRef.id, status: "open", priority: "high", title: `${safeText(driverSnap.data()?.displayName || driverSnap.data()?.legalName || user.name || "Driver", 120)} · ${body.vehicle.type.replaceAll("_", " ")}`, createdAt: now, updatedAt: now }, { merge: true });
      await notifyRoleAudience({ db, messaging, auth, title: "Active Driver vehicle needs review", body: `${safeText(driverSnap.data()?.displayName || driverSnap.data()?.legalName || user.name || "Driver", 120)} added a ${body.vehicle.type.replaceAll("_", " ")} for approval.`, href: `/admin/drivers?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "reviews", eventType: "driver_vehicle.submitted", importance: "high", entityType: "driverVehicle", entityId: vehicleRef.id, email: true, forceOperationalEmail: true }, ["super_admin", "driver_operations_coordinator", "operations_manager", "risk_compliance_officer"]);
      return Response.json({ ok: true, vehicleId: vehicleRef.id });
    }

    if (body.action === "document") {
      if (!body.document) throw Object.assign(new Error("Document details are required."), { status: 400 });
      const expectedPrefix = `driver-applications/${user.uid}/documents/`;
      if (!body.document.storagePath.startsWith(expectedPrefix)) throw Object.assign(new Error("That Driver document path is not allowed."), { status: 403 });
      const [currentAppSnap, currentDriverSnap] = await Promise.all([appRef.get(), db.collection("drivers").doc(user.uid).get()]);
      const currentStatus = currentAppSnap.data()?.status || "application_started";
      const activeLifecycle = currentDriverSnap.exists && ["approved", "ready", "active", "temporarily_unavailable", "suspended"].includes(currentDriverSnap.data()?.status);
      const docRef = db.collection("driverDocuments").doc();
      await docRef.set({ driverId: user.uid, ...body.document, status: "uploaded", uploadedAt: now, updatedAt: now });
      await appRef.set({ status: activeLifecycle ? currentStatus : "application_started", updatedAt: now }, { merge: true });
      await db.collection("adminQueueItems").doc(`driver_document_${docRef.id}`).set({ queue: "driver-documents", type: "driver_document_review", entityId: docRef.id, driverId: user.uid, documentId: docRef.id, status: "open", priority: activeLifecycle ? "high" : "normal", title: `${safeText(currentAppSnap.data()?.legalName || user.name || "Driver", 120)} · ${body.document.type.replaceAll("_", " ")}`, createdAt: now, updatedAt: now }, { merge: true });
      await notifyRoleAudience({ db, messaging, auth, title: activeLifecycle ? "Active Driver document needs review" : "Driver document needs review", body: `${safeText(currentAppSnap.data()?.legalName || user.name || "Driver", 120)} uploaded ${body.document.type.replaceAll("_", " ")} evidence.`, href: `/admin/drivers?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "reviews", eventType: "driver_document.submitted", importance: activeLifecycle ? "high" : "normal", entityType: "driverDocument", entityId: docRef.id, email: activeLifecycle, forceOperationalEmail: activeLifecycle }, ["super_admin", "driver_operations_coordinator", "operations_manager", "risk_compliance_officer"]);
      return Response.json({ ok: true, documentId: docRef.id, activeRenewal: activeLifecycle });
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
      const appSnap = await appRef.get();
      const current = appSnap.exists ? appSnap.data() : {};
      const vehicleSnap = await db.collection("driverVehicles").doc(`${user.uid}_primary`).get();
      const requested = normalizeCapabilities(current.requestedCapabilities || [], vehicleSnap.data()?.type || "");
      const requiredModules = trainingRequirementsFor(requested);
      const modules = { ...(current.trainingModules || {}) };
      if (!body.trainingModuleId) throw Object.assign(new Error("Choose the training module you completed."), { status: 400 });
      const module = DRIVER_TRAINING_MODULES[body.trainingModuleId];
      if (!requiredModules.includes(body.trainingModuleId)) throw Object.assign(new Error("That training module is not required for your selected work."), { status: 400 });
      if (body.trainingComplete !== false) {
        if (body.trainingAnswer !== module.check.answer) throw Object.assign(new Error("Review the module and choose the correct answer before completing it."), { status: 400 });
        modules[body.trainingModuleId] = { completed: true, version: module.version, completedAt: new Date().toISOString() };
      } else {
        modules[body.trainingModuleId] = { completed: false, version: module.version, updatedAt: new Date().toISOString() };
      }
      const nextApplication = { ...current, trainingModules: modules };
      const trainingComplete = requiredModules.every((moduleId) => trainingModuleIsCurrent(nextApplication, moduleId));
      await appRef.set({ trainingModules: modules, trainingComplete, updatedAt: now }, { merge: true });
      return Response.json({ ok: true, trainingComplete, trainingModules: modules });
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
