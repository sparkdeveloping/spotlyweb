import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { applicationReadiness } from "@/lib/driver-delivery-server";
import { DRIVER_CAPABILITIES, DRIVER_TRAINING_MODULES, documentRequirementsFor, normalizeCapabilities, trainingModuleIsCurrent, trainingRequirementsFor } from "@/lib/driver-capabilities";
import { normalizeZimbabwePhone, safeText } from "@/lib/server-helpers";
import { accountLast4, encryptFinancialValue } from "@/lib/business-money-server";
import { notifyRoleAudience, notifyUser } from "@/lib/notification-server";

export const runtime = "nodejs";

const VEHICLE_TYPES = ["motorcycle", "car", "van", "bicycle"];
const VEHICLE_DOCUMENT_TYPES = new Set(["registration", "insurance", "vehicle_fitness"]);
const EXPIRY_REQUIRED_TYPES = new Set(["licence", "insurance", "vehicle_fitness"]);

const vehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  registration: z.string().max(40).optional().default(""),
  make: z.string().max(80).optional().default(""),
  model: z.string().max(80).optional().default(""),
  year: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
  ownership: z.enum(["driver_owned", "fleet_owned", "rented"]).default("driver_owned"),
  requestedCapabilities: z.array(z.enum(Object.keys(DRIVER_CAPABILITIES))).max(8).optional().default([])
});

const schema = z.object({
  action: z.enum(["save", "submit", "vehicle", "vehicle_submit", "document", "payout", "training"]),
  vehicleId: z.string().max(180).optional(),
  application: z.object({
    legalName: z.string().max(160).optional(), phone: z.string().max(40).optional(), city: z.string().max(80).optional(),
    preferredZones: z.array(z.string().max(100)).max(30).optional(), emergencyContactName: z.string().max(160).optional(), emergencyContactPhone: z.string().max(40).optional(),
    requestedCapabilities: z.array(z.enum(Object.keys(DRIVER_CAPABILITIES))).max(8).optional(),
    currentStep: z.number().int().min(0).max(10).optional(), agreementsAccepted: z.boolean().optional(), locationConsent: z.boolean().optional()
  }).optional(),
  vehicle: vehicleSchema.optional(),
  document: z.object({
    type: z.enum(["identity", "licence", "registration", "insurance", "vehicle_fitness", "other"]),
    storagePath: z.string().min(3).max(500), fileName: z.string().max(180), expiresAt: z.string().max(80).nullable().optional(),
    referenceNumber: z.string().max(100).optional(), vehicleId: z.string().max(180).optional()
  }).optional(),
  payout: z.object({ type: z.enum(["bank", "mobile_money"]), provider: z.string().min(2).max(80), recipientName: z.string().min(2).max(160), identifier: z.string().min(3).max(120) }).optional(),
  trainingComplete: z.boolean().optional(),
  trainingModuleId: z.enum(Object.keys(DRIVER_TRAINING_MODULES)).optional(),
  trainingAnswer: z.number().int().min(0).max(8).optional()
});

function normalizedVehicle(vehicle = {}) {
  const type = vehicle.type;
  const requestedCapabilities = normalizeCapabilities(vehicle.requestedCapabilities || [], type).filter((capabilityId) => DRIVER_CAPABILITIES[capabilityId]?.vehicleTypes?.includes(type));
  return {
    type,
    registration: type === "bicycle" ? "" : safeText(vehicle.registration || "", 40).toUpperCase(),
    make: safeText(vehicle.make || "", 80),
    model: safeText(vehicle.model || "", 80),
    year: vehicle.year ? Number(vehicle.year) : null,
    ownership: vehicle.ownership || "driver_owned",
    requestedCapabilities
  };
}

function newestDocument(documents, type, vehicleId = "") {
  const scoped = VEHICLE_DOCUMENT_TYPES.has(type);
  return documents
    .filter((item) => {
      if (item.type !== type) return false;
      if (!scoped) return true;
      if (item.vehicleId === vehicleId) return true;
      return vehicleId.endsWith("_primary") && !item.vehicleId;
    })
    .sort((a, b) => new Date(b.updatedAt || b.uploadedAt || 0).getTime() - new Date(a.updatedAt || a.uploadedAt || 0).getTime())[0] || null;
}

function documentReadyForSubmission(document) {
  if (!document || !["uploaded", "pending_review", "approved"].includes(document.status || "uploaded")) return false;
  if (!document.expiresAt) return true;
  return new Date(document.expiresAt).getTime() > Date.now();
}

async function assertActiveDriver(db, uid) {
  const driverSnap = await db.collection("drivers").doc(uid).get();
  if (!driverSnap.exists || !["approved", "ready", "active", "temporarily_unavailable", "suspended"].includes(driverSnap.data()?.status)) {
    throw Object.assign(new Error("Finish Driver activation before adding another vehicle here."), { status: 409 });
  }
  return driverSnap;
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db, messaging, auth } = getAdminServices();
    const appRef = db.collection("driverApplications").doc(user.uid);
    const now = FieldValue.serverTimestamp();

    if (body.action === "save") {
      const values = body.application || {};
      const currentStep = Number(values.currentStep ?? 0);
      const vehicleType = body.vehicle?.type || null;
      const requestedCapabilities = normalizeCapabilities(values.requestedCapabilities || [], vehicleType || "").filter((capabilityId) => !vehicleType || DRIVER_CAPABILITIES[capabilityId]?.vehicleTypes?.includes(vehicleType));
      // Step 1 (identity/contact) must be saveable before the applicant has even seen vehicle fields.
      if (body.vehicle && currentStep >= 2 && body.vehicle.type !== "bicycle" && safeText(body.vehicle.registration || "", 40).length < 2) {
        throw Object.assign(new Error("Add the motor vehicle registration before continuing."), { status: 400 });
      }
      if (body.vehicle && currentStep >= 2 && body.vehicle.type !== "bicycle" && (!safeText(body.vehicle.make || "", 80) || !safeText(body.vehicle.model || "", 80))) {
        throw Object.assign(new Error("Add the motor vehicle make and model before continuing."), { status: 400 });
      }
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
        currentStep,
        agreementsAccepted: Boolean(values.agreementsAccepted),
        locationConsent: Boolean(values.locationConsent),
        status: "application_started",
        updatedAt: now,
        createdAt: now
      }, { merge: true });
      // Only persist the primary vehicle after the applicant has actually completed Work & vehicle.
      if (body.vehicle && currentStep >= 2) {
        const vehicle = normalizedVehicle({ ...body.vehicle, requestedCapabilities });
        await db.collection("driverVehicles").doc(`${user.uid}_primary`).set({ driverId: user.uid, ...vehicle, status: "pending_review", setupComplete: true, updatedAt: now, createdAt: now }, { merge: true });
      }
      return Response.json({ ok: true });
    }

    if (body.action === "vehicle") {
      if (!body.vehicle) throw Object.assign(new Error("Vehicle details are required."), { status: 400 });
      await assertActiveDriver(db, user.uid);
      const vehicle = normalizedVehicle(body.vehicle);
      if (vehicle.type !== "bicycle" && vehicle.registration.length < 2) throw Object.assign(new Error("Add the motor vehicle registration."), { status: 400 });
      if (vehicle.type !== "bicycle" && (!vehicle.make || !vehicle.model)) throw Object.assign(new Error("Add the motor vehicle make and model."), { status: 400 });
      if (!vehicle.requestedCapabilities.length) throw Object.assign(new Error("Choose at least one kind of work for this vehicle."), { status: 400 });
      const vehicleRef = body.vehicleId ? db.collection("driverVehicles").doc(body.vehicleId) : db.collection("driverVehicles").doc();
      if (body.vehicleId) {
        const existing = await vehicleRef.get();
        if (!existing.exists || existing.data()?.driverId !== user.uid) throw Object.assign(new Error("That Driver vehicle was not found."), { status: 404 });
        if (!["setup_required", "information_required", "rejected"].includes(existing.data()?.status)) throw Object.assign(new Error("This vehicle can no longer be edited in setup."), { status: 409 });
      }
      await vehicleRef.set({ driverId: user.uid, ...vehicle, status: "setup_required", setupComplete: false, updatedAt: now, createdAt: now }, { merge: true });
      return Response.json({ ok: true, vehicleId: vehicleRef.id, status: "setup_required" });
    }

    if (body.action === "vehicle_submit") {
      if (!body.vehicleId) throw Object.assign(new Error("Choose the vehicle you are submitting."), { status: 400 });
      const driverSnap = await assertActiveDriver(db, user.uid);
      const vehicleRef = db.collection("driverVehicles").doc(body.vehicleId);
      const [vehicleSnap, documentQuery, currentAppSnap] = await Promise.all([
        vehicleRef.get(),
        db.collection("driverDocuments").where("driverId", "==", user.uid).limit(100).get(),
        appRef.get()
      ]);
      if (!vehicleSnap.exists || vehicleSnap.data()?.driverId !== user.uid) throw Object.assign(new Error("That Driver vehicle was not found."), { status: 404 });
      const vehicle = { id: vehicleSnap.id, ...vehicleSnap.data() };
      if (!["setup_required", "information_required", "rejected"].includes(vehicle.status)) throw Object.assign(new Error("This vehicle is already with Spotly for review."), { status: 409 });
      const capabilities = normalizeCapabilities(vehicle.requestedCapabilities || [], vehicle.type).filter((capabilityId) => DRIVER_CAPABILITIES[capabilityId]?.vehicleTypes?.includes(vehicle.type));
      if (!capabilities.length) throw Object.assign(new Error("Choose at least one kind of work for this vehicle."), { status: 409 });
      const documents = documentQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
      const requiredDocuments = documentRequirementsFor({ vehicleType: vehicle.type, capabilities });
      const missing = requiredDocuments.filter((type) => !documentReadyForSubmission(newestDocument(documents, type, vehicle.id)));
      if (missing.length) throw Object.assign(new Error(`Add the required evidence before submitting this vehicle: ${missing.map((item) => item.replaceAll("_", " ")).join(", ")}.`), { status: 409, blockers: missing });
      const mergedRequestedCapabilities = [...new Set([...(currentAppSnap.data()?.requestedCapabilities || []), ...capabilities])];
      await Promise.all([
        vehicleRef.set({ status: "pending_review", setupComplete: true, submittedAt: now, reviewReason: null, updatedAt: now }, { merge: true }),
        appRef.set({ requestedCapabilities: mergedRequestedCapabilities, updatedAt: now }, { merge: true }),
        db.collection("drivers").doc(user.uid).set({ requestedCapabilities: mergedRequestedCapabilities, updatedAt: now }, { merge: true })
      ]);
      const displayName = safeText(driverSnap.data()?.displayName || driverSnap.data()?.legalName || currentAppSnap.data()?.legalName || user.name || "Driver", 120);
      await db.collection("adminQueueItems").doc(`driver_vehicle_${vehicleRef.id}`).set({
        queue: "driver-vehicles", type: "driver_vehicle_review", entityId: vehicleRef.id, driverId: user.uid, vehicleId: vehicleRef.id,
        status: "open", priority: "high", title: `${displayName} · ${vehicle.type.replaceAll("_", " ")}`, description: `Review ${vehicle.registration || vehicle.type} and its required evidence.`, createdAt: now, updatedAt: now
      }, { merge: true });
      await Promise.allSettled([
        notifyUser({ db, messaging, auth, userId: user.uid, title: "Vehicle sent to Spotly", body: "Your vehicle setup and evidence are now waiting for Driver Operations review.", href: "/profile", category: "driver_review", workspace: "driver", module: "reviews", eventType: "driver_vehicle.submitted", importance: "high", entityType: "driverVehicle", entityId: vehicleRef.id, email: true, forceOperationalEmail: true }),
        notifyRoleAudience({ db, messaging, auth, title: "Driver vehicle needs review", body: `${displayName} submitted a ${vehicle.type.replaceAll("_", " ")} with its required evidence.`, href: `/mobility?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "reviews", eventType: "driver_vehicle.submitted", importance: "high", entityType: "driverVehicle", entityId: vehicleRef.id, email: true, forceOperationalEmail: true }, ["super_admin", "driver_operations_coordinator", "operations_manager", "risk_compliance_officer"])
      ]);
      return Response.json({ ok: true, vehicleId: vehicleRef.id, status: "pending_review" });
    }

    if (body.action === "document") {
      if (!body.document) throw Object.assign(new Error("Document details are required."), { status: 400 });
      const expectedPrefix = `driver-applications/${user.uid}/documents/`;
      if (!body.document.storagePath.startsWith(expectedPrefix)) throw Object.assign(new Error("That Driver document path is not allowed."), { status: 403 });
      const inferredVehicleId = VEHICLE_DOCUMENT_TYPES.has(body.document.type) ? (body.document.vehicleId || `${user.uid}_primary`) : null;
      if (inferredVehicleId) {
        const vehicleSnap = await db.collection("driverVehicles").doc(inferredVehicleId).get();
        if (!vehicleSnap.exists || vehicleSnap.data()?.driverId !== user.uid) throw Object.assign(new Error("That document is not linked to one of your vehicles."), { status: 404 });
      }
      if (EXPIRY_REQUIRED_TYPES.has(body.document.type) && !body.document.expiresAt) throw Object.assign(new Error(`Add the expiry date for your ${body.document.type.replaceAll("_", " ")}.`), { status: 400 });
      if (body.document.expiresAt && new Date(body.document.expiresAt).getTime() <= Date.now()) throw Object.assign(new Error("That document is already expired."), { status: 400 });
      const [currentAppSnap, currentDriverSnap] = await Promise.all([appRef.get(), db.collection("drivers").doc(user.uid).get()]);
      const currentStatus = currentAppSnap.data()?.status || "application_started";
      const activeLifecycle = currentDriverSnap.exists && ["approved", "ready", "active", "temporarily_unavailable", "suspended"].includes(currentDriverSnap.data()?.status);
      const docRef = db.collection("driverDocuments").doc();
      await docRef.set({
        driverId: user.uid, type: body.document.type, storagePath: body.document.storagePath, fileName: body.document.fileName,
        expiresAt: body.document.expiresAt || null, referenceNumber: safeText(body.document.referenceNumber || "", 100) || null,
        vehicleId: inferredVehicleId, status: "uploaded", uploadedAt: now, updatedAt: now
      });
      await appRef.set({ status: activeLifecycle ? currentStatus : "application_started", updatedAt: now }, { merge: true });
      await db.collection("adminQueueItems").doc(`driver_document_${docRef.id}`).set({
        queue: "driver-documents", type: "driver_document_review", entityId: docRef.id, driverId: user.uid, documentId: docRef.id, vehicleId: inferredVehicleId,
        status: "open", priority: activeLifecycle ? "high" : "normal", title: `${safeText(currentAppSnap.data()?.legalName || user.name || "Driver", 120)} · ${body.document.type.replaceAll("_", " ")}`,
        description: inferredVehicleId ? `Evidence linked to vehicle ${inferredVehicleId}.` : "Driver-level evidence.", createdAt: now, updatedAt: now
      }, { merge: true });
      await notifyRoleAudience({ db, messaging, auth, title: activeLifecycle ? "Active Driver document needs review" : "Driver document needs review", body: `${safeText(currentAppSnap.data()?.legalName || user.name || "Driver", 120)} uploaded ${body.document.type.replaceAll("_", " ")} evidence.`, href: `/mobility?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "reviews", eventType: "driver_document.submitted", importance: activeLifecycle ? "high" : "normal", entityType: "driverDocument", entityId: docRef.id, email: activeLifecycle, forceOperationalEmail: activeLifecycle }, ["super_admin", "driver_operations_coordinator", "operations_manager", "risk_compliance_officer"]);
      return Response.json({ ok: true, documentId: docRef.id, activeRenewal: activeLifecycle, vehicleId: inferredVehicleId });
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
        notifyRoleAudience({ db, messaging, auth, title: "Driver payout account needs review", body: `${safeText(body.payout.recipientName, 160)} submitted Driver payout details for verification.`, href: `/mobility?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "money", eventType: "driver_payout_account.submitted", importance: "high", entityType: "driverPayoutAccount", entityId: user.uid, email: true, forceOperationalEmail: true }, ["super_admin", "finance_admin", "operations_manager"])
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

    const [appSnap, vehicleSnap, documentQuery] = await Promise.all([
      appRef.get(), db.collection("driverVehicles").doc(`${user.uid}_primary`).get(), db.collection("driverDocuments").where("driverId", "==", user.uid).limit(100).get()
    ]);
    if (!appSnap.exists) throw Object.assign(new Error("Complete your Driver application before submitting."), { status: 409 });
    const primaryVehicle = vehicleSnap.exists ? { id: vehicleSnap.id, ...vehicleSnap.data() } : null;
    const documents = documentQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const readiness = applicationReadiness(appSnap.data(), primaryVehicle, documents);
    if (!readiness.complete) throw Object.assign(new Error("Complete every Driver application step before submitting."), { status: 409, blockers: readiness.checks.filter((item) => !item.ok) });
    await appRef.set({ status: "application_submitted", submittedAt: now, updatedAt: now }, { merge: true });
    await db.collection("adminQueueItems").doc(`driver_application_${user.uid}`).set({
      queue: "driver-applications", type: "driver_application", entityId: user.uid, driverId: user.uid, status: "open", priority: "normal", title: safeText(appSnap.data().legalName || user.name || "Driver application", 160), createdAt: now, updatedAt: now
    }, { merge: true });
    const driverName = safeText(appSnap.data().legalName || user.name || "Driver", 160);
    await Promise.allSettled([
      notifyUser({ db, messaging, auth, userId: user.uid, title: "Driver application sent to Spotly", body: "Your application is saved and waiting for review. We will notify you here and by email when anything changes.", href: "/", category: "driver_review", workspace: "driver", module: "reviews", eventType: "driver_application.submitted", importance: "high", entityType: "driverApplication", entityId: user.uid, email: true, forceOperationalEmail: true }),
      notifyRoleAudience({ db, messaging, auth, title: `Driver application ready · ${driverName}`, body: "A Driver completed the application and is ready for document and eligibility review.", href: `/mobility?driver=${encodeURIComponent(user.uid)}`, category: "admin_review", workspace: "admin", module: "reviews", eventType: "driver_application.submitted", importance: "high", entityType: "driverApplication", entityId: user.uid, email: true, forceOperationalEmail: true }, ["super_admin", "driver_operations_coordinator", "operations_manager", "risk_compliance_officer"])
    ]);
    return Response.json({ ok: true, status: "application_submitted" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Driver application details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
