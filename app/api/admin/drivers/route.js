import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { docsData, docData, operationalEligibility, notifyUsers } from "@/lib/driver-delivery-server";
import { driverBalanceAccountId, sanitizeDriverBalance } from "@/lib/driver-money-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";
const ADMIN_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "risk_compliance_officer", "finance_admin"];
const schema = z.object({
  driverId: z.string().min(1).max(180),
  action: z.enum(["approve", "request_information", "reject", "suspend", "reinstate", "compliance_hold", "clear_compliance_hold", "safety_hold", "clear_safety_hold", "approve_document", "reject_document", "approve_vehicle", "verify_payout_account", "reject_payout_account", "end_session"]),
  reason: z.string().max(1000).optional(), documentId: z.string().max(180).optional(), vehicleId: z.string().max(180).optional()
});

async function loadDriverBundle(db, driverId) {
  const [application, driver, vehicles, documents, presence, jobs, earnings, payouts, incidents, payoutAccount, usdBalance, zwgBalance] = await Promise.all([
    db.collection("driverApplications").doc(driverId).get(), db.collection("drivers").doc(driverId).get(),
    db.collection("driverVehicles").where("driverId", "==", driverId).limit(20).get(), db.collection("driverDocuments").where("driverId", "==", driverId).limit(100).get(),
    db.collection("driverPresence").doc(driverId).get(), db.collection("deliveryJobs").where("assignedDriverId", "==", driverId).limit(100).get(),
    db.collection("driverEarningsLedger").where("driverId", "==", driverId).limit(250).get(), db.collection("driverPayouts").where("driverId", "==", driverId).limit(100).get(),
    db.collection("driverIncidents").where("driverId", "==", driverId).limit(100).get(),
    db.collection("driverPayoutAccounts").doc(driverId).get(), db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(driverId, "USD")).get(), db.collection("driverBalanceAccounts").doc(driverBalanceAccountId(driverId, "ZWG")).get()
  ]);
  const bundle = { application: docData(application), driver: docData(driver), vehicles: docsData(vehicles), documents: docsData(documents), presence: docData(presence), jobs: docsData(jobs), earnings: docsData(earnings), payouts: docsData(payouts), incidents: docsData(incidents), payoutAccount: payoutAccount.exists ? { ...docData(payoutAccount), identifierEncrypted: undefined } : null, balances: { USD: usdBalance.exists ? sanitizeDriverBalance(usdBalance.data()) : null, ZWG: zwgBalance.exists ? sanitizeDriverBalance(zwgBalance.data()) : null } };
  bundle.eligibility = operationalEligibility({ driver: bundle.driver, vehicle: bundle.vehicles.find((item) => item.status === "approved") || bundle.vehicles[0], documents: bundle.documents, presence: bundle.presence });
  return bundle;
}

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ADMIN_ROLES });
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const driverId = url.searchParams.get("driverId");
    if (driverId) return Response.json({ ok: true, ...(await loadDriverBundle(db, driverId)) });
    const [applications, drivers, presence] = await Promise.all([
      db.collection("driverApplications").limit(250).get(), db.collection("drivers").limit(250).get(), db.collection("driverPresence").limit(250).get()
    ]);
    const driverMap = new Map(docsData(drivers).map((item) => [item.id, item]));
    const presenceMap = new Map(docsData(presence).map((item) => [item.id, item]));
    const rows = docsData(applications).map((app) => ({ ...app, driver: driverMap.get(app.userId || app.id) || null, presence: presenceMap.get(app.userId || app.id) || null }));
    driverMap.forEach((driver, id) => { if (!rows.some((item) => (item.userId || item.id) === id)) rows.push({ id, userId: id, legalName: driver.displayName || driver.legalName || "Driver", status: driver.status, driver, presence: presenceMap.get(id) || null }); });
    return Response.json({ ok: true, drivers: rows });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ADMIN_ROLES });
    const body = schema.parse(await request.json());
    const actorRoles = new Set(actor.profile?.roles || []);
    const fullAdmin = actorRoles.has("super_admin") || actorRoles.has("admin") || actorRoles.has("platform_admin");
    const payoutReview = ["verify_payout_account", "reject_payout_account"].includes(body.action);
    if (actorRoles.has("finance_admin") && !fullAdmin && !payoutReview) throw Object.assign(new Error("Finance reviewers can only review Driver payout destinations in this workspace."), { status: 403 });
    if (payoutReview && !fullAdmin && !actorRoles.has("finance_admin") && !actorRoles.has("operations_manager")) throw Object.assign(new Error("Your role cannot review Driver payout destinations."), { status: 403 });
    const reason = safeText(body.reason || "", 1000);
    if (["request_information", "reject", "suspend", "compliance_hold", "safety_hold", "reject_document", "reject_payout_account"].includes(body.action) && reason.length < 3) throw Object.assign(new Error("Add a clear reason for this action."), { status: 400 });
    const { db, messaging, auth } = getAdminServices();
    const appRef = db.collection("driverApplications").doc(body.driverId);
    const driverRef = db.collection("drivers").doc(body.driverId);
    const auditRef = db.collection("auditLogs").doc();
    const now = FieldValue.serverTimestamp();
    const [appSnap, userSnap] = await Promise.all([appRef.get(), db.collection("users").doc(body.driverId).get()]);
    if (!appSnap.exists && !["end_session"].includes(body.action)) throw Object.assign(new Error("The Driver application was not found."), { status: 404 });
    const app = appSnap.data() || {};
    const updates = {};
    if (body.action === "approve") {
      const [vehicleQuery, docsQuery] = await Promise.all([
        db.collection("driverVehicles").where("driverId", "==", body.driverId).limit(10).get(),
        db.collection("driverDocuments").where("driverId", "==", body.driverId).limit(50).get()
      ]);
      const approvedVehicle = vehicleQuery.docs.some((item) => item.data().status === "approved");
      const approvedTypes = new Set(docsQuery.docs.filter((item) => item.data().status === "approved").map((item) => item.data().type));
      if (!approvedVehicle || !approvedTypes.has("identity") || !approvedTypes.has("licence")) throw Object.assign(new Error("Approve the Driver vehicle, identification and licence before approving the application."), { status: 409 });
      updates.status = "approved"; updates.approvedAt = now; updates.reviewedBy = actor.uid;
      const batch = db.batch();
      batch.set(appRef, updates, { merge: true });
      batch.set(driverRef, { userId: body.driverId, legalName: app.legalName || userSnap.data()?.displayName || "Driver", displayName: app.legalName || userSnap.data()?.displayName || "Driver", phone: app.phone || userSnap.data()?.phoneNumber || "", city: app.city || "Harare", zoneIds: app.preferredZones || [], status: "ready", approvedAt: now, approvedBy: actor.uid, complianceHold: false, safetyHold: false, updatedAt: now, createdAt: now }, { merge: true });
      batch.set(db.collection("adminQueueItems").doc(`driver_application_${body.driverId}`), { status: "completed", completedAt: now, completedBy: actor.uid, updatedAt: now }, { merge: true });
      await batch.commit();
    } else if (body.action === "request_information") await appRef.set({ status: "information_required", reviewReason: reason, reviewedBy: actor.uid, updatedAt: now }, { merge: true });
    else if (body.action === "reject") await appRef.set({ status: "rejected", reviewReason: reason, reviewedBy: actor.uid, updatedAt: now }, { merge: true });
    else if (body.action === "suspend") await driverRef.set({ status: "suspended", suspensionReason: reason, updatedAt: now }, { merge: true });
    else if (body.action === "reinstate") await driverRef.set({ status: "ready", suspensionReason: null, updatedAt: now }, { merge: true });
    else if (body.action === "compliance_hold") await driverRef.set({ complianceHold: true, complianceHoldReason: reason, updatedAt: now }, { merge: true });
    else if (body.action === "clear_compliance_hold") await driverRef.set({ complianceHold: false, complianceHoldReason: null, updatedAt: now }, { merge: true });
    else if (body.action === "safety_hold") await driverRef.set({ safetyHold: true, safetyHoldReason: reason, updatedAt: now }, { merge: true });
    else if (body.action === "clear_safety_hold") await driverRef.set({ safetyHold: false, safetyHoldReason: null, updatedAt: now }, { merge: true });
    else if (["approve_document", "reject_document"].includes(body.action)) {
      if (!body.documentId) throw Object.assign(new Error("Choose a document."), { status: 400 });
      const ref = db.collection("driverDocuments").doc(body.documentId); const snap = await ref.get();
      if (!snap.exists || snap.data().driverId !== body.driverId) throw Object.assign(new Error("The Driver document was not found."), { status: 404 });
      await ref.set({ status: body.action === "approve_document" ? "approved" : "rejected", reviewReason: reason || null, reviewedAt: now, reviewedBy: actor.uid, updatedAt: now }, { merge: true });
    } else if (["verify_payout_account", "reject_payout_account"].includes(body.action)) {
      const ref = db.collection("driverPayoutAccounts").doc(body.driverId); const snap = await ref.get();
      if (!snap.exists) throw Object.assign(new Error("The Driver payout account was not found."), { status: 404 });
      await ref.set({ verificationState: body.action === "verify_payout_account" ? "verified" : "rejected", verificationReason: reason || null, reviewedAt: now, reviewedBy: actor.uid, updatedAt: now }, { merge: true });
    } else if (body.action === "approve_vehicle") {
      if (!body.vehicleId) throw Object.assign(new Error("Choose a vehicle."), { status: 400 });
      const ref = db.collection("driverVehicles").doc(body.vehicleId); const snap = await ref.get();
      if (!snap.exists || snap.data().driverId !== body.driverId) throw Object.assign(new Error("The Driver vehicle was not found."), { status: 404 });
      await ref.set({ status: "approved", reviewedAt: now, reviewedBy: actor.uid, updatedAt: now }, { merge: true });
    } else if (body.action === "end_session") await db.collection("driverPresence").doc(body.driverId).set({ online: false, availabilityState: "offline", currentJobId: null, currentLocation: null, updatedAt: now }, { merge: true });

    await auditRef.set({ actorId: actor.uid, action: `driver.${body.action}`, entityType: "driver", entityId: body.driverId, reason, metadata: { documentId: body.documentId || null, vehicleId: body.vehicleId || null }, source: "admin_driver_operations", createdAt: now });
    const notices = {
      approve: ["You're approved to drive with Spotly", "Your Driver application is approved. Open Spotly Driver to finish setup and go online."],
      request_information: ["Spotly needs more information", reason || "Open your Driver application to see what needs your attention."],
      reject: ["Driver application update", reason || "Open your Driver application to review the decision."],
      suspend: ["Driver account paused", reason || "Open Spotly Driver for details."],
      reinstate: ["Driver account restored", "Your Driver account is available again."],
      approve_document: ["Driver document approved", "Spotly approved one of your Driver documents."],
      reject_document: ["Driver document needs attention", reason || "A Driver document needs to be replaced or corrected."],
      approve_vehicle: ["Vehicle approved", "Your vehicle was approved for Driver operations."],
      verify_payout_account: ["Payout account verified", "Your Driver payout destination was verified."],
      reject_payout_account: ["Payout account needs attention", reason || "Review your payout details and submit them again."]
    };
    if (notices[body.action]) {
      const [title, noticeBody] = notices[body.action];
      const reviewAction = ["approve", "request_information", "reject", "approve_document", "reject_document", "approve_vehicle", "verify_payout_account", "reject_payout_account"].includes(body.action);
      await notifyUsers(db, messaging, [body.driverId], {
        title, body: noticeBody, href: "/", category: reviewAction ? "driver_review" : "driver_account", workspace: "driver", module: reviewAction ? "reviews" : "account",
        eventType: `driver.${body.action}`, importance: reviewAction ? "high" : "normal", email: reviewAction, auth, forceOperationalEmail: reviewAction
      });
    }
    return Response.json({ ok: true, bundle: await loadDriverBundle(db, body.driverId) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Driver action." }, { status: 400 });
    return apiError(error);
  }
}
