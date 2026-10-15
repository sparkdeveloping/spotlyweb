import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { docsData } from "@/lib/driver-delivery-server";
import { capabilityRequirements, normalizeCapabilities } from "@/lib/driver-capabilities";

export const runtime = "nodejs";
const ADMIN_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator", "risk_compliance_officer"];
const DONE_DELIVERY = new Set(["delivered", "failed", "cancelled", "returned"]);
const DONE_RIDE = new Set(["completed", "failed", "cancelled"]);
const DONE_SEND = new Set(["delivered", "failed", "cancelled", "returned"]);

function millis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ADMIN_ROLES });
    const { db } = getAdminServices();
    const [driversSnap, applicationsSnap, presenceSnap, deliveriesSnap, ridesSnap, parcelsSnap, incidentsSnap, vehiclesSnap, documentsSnap] = await Promise.all([
      db.collection("drivers").limit(500).get(),
      db.collection("driverApplications").limit(500).get(),
      db.collection("driverPresence").limit(500).get(),
      db.collection("deliveryJobs").limit(500).get(),
      db.collection("rideTrips").limit(500).get(),
      db.collection("parcelJobs").limit(500).get(),
      db.collection("driverIncidents").limit(500).get(),
      db.collection("driverVehicles").limit(1000).get(),
      db.collection("driverDocuments").limit(2000).get()
    ]);

    const drivers = docsData(driversSnap);
    const applications = docsData(applicationsSnap);
    const presence = docsData(presenceSnap);
    const deliveries = docsData(deliveriesSnap).filter((item) => !DONE_DELIVERY.has(item.state));
    const rides = docsData(ridesSnap).filter((item) => !DONE_RIDE.has(item.state));
    const parcels = docsData(parcelsSnap).filter((item) => !DONE_SEND.has(item.state));
    const incidents = docsData(incidentsSnap).filter((item) => !["resolved", "closed"].includes(item.status));
    const vehicles = docsData(vehiclesSnap);
    const documents = docsData(documentsSnap);
    const applicationMap = new Map(applications.map((item) => [item.userId || item.id, item]));
    const vehiclesByDriver = new Map();
    const documentsByDriver = new Map();
    vehicles.forEach((item) => {
      const driverId = item.driverId || item.userId;
      if (!driverId) return;
      vehiclesByDriver.set(driverId, [...(vehiclesByDriver.get(driverId) || []), item]);
    });
    documents.forEach((item) => {
      const driverId = item.driverId || item.userId;
      if (!driverId) return;
      documentsByDriver.set(driverId, [...(documentsByDriver.get(driverId) || []), item]);
    });
    const presenceMap = new Map(presence.map((item) => [item.id, item]));
    const workByDriver = new Map();
    deliveries.forEach((item) => item.assignedDriverId && workByDriver.set(item.assignedDriverId, { type: "delivery", id: item.id, number: item.number, state: item.state, pickup: item.pickup, dropoff: item.dropoff, fulfilmentMode: item.fulfilmentMode }));
    rides.forEach((item) => item.assignedDriverId && workByDriver.set(item.assignedDriverId, { type: "ride", id: item.id, number: item.number, state: item.state, pickup: item.pickup, dropoff: item.dropoff }));
    parcels.forEach((item) => item.assignedDriverId && workByDriver.set(item.assignedDriverId, { type: "send", id: item.id, number: item.number, state: item.state, pickup: item.pickup, dropoff: item.dropoff }));
    const incidentCount = new Map();
    incidents.forEach((item) => incidentCount.set(item.driverId, (incidentCount.get(item.driverId) || 0) + 1));
    const now = Date.now();
    const rows = drivers.map((driver) => {
      const driverPresence = presenceMap.get(driver.id) || null;
      const application = applicationMap.get(driver.id) || null;
      const locationAgeMs = millis(driverPresence?.locationUpdatedAt) ? now - millis(driverPresence.locationUpdatedAt) : null;
      const locationHealth = !driverPresence?.online ? "offline" : !driverPresence?.currentLocation ? "missing" : locationAgeMs <= 45_000 ? "good" : locationAgeMs <= 120_000 ? "weak" : "stale";
      const activeCapabilities = Object.entries(driver.capabilities || {}).filter(([, value]) => (typeof value === "string" ? value : value?.status) === "active").map(([id]) => id);
      return {
        id: driver.id,
        displayName: driver.displayName || driver.legalName || application?.legalName || "Driver",
        city: driver.city || application?.city || "",
        status: driver.status || application?.status || "unknown",
        capabilities: activeCapabilities,
        online: driverPresence?.online === true,
        availabilityState: driverPresence?.availabilityState || "offline",
        location: driverPresence?.currentLocation || null,
        locationUpdatedAt: driverPresence?.locationUpdatedAt || null,
        locationHealth,
        dispatchable: Boolean(driverPresence?.online && ["good", "weak"].includes(locationHealth) && ["ready", "active", "approved"].includes(driver.status) && !driver.complianceHold && !driver.safetyHold && !driverPresence?.currentJobId),
        work: workByDriver.get(driver.id) || null,
        openIncidents: incidentCount.get(driver.id) || 0,
        complianceHold: Boolean(driver.complianceHold),
        safetyHold: Boolean(driver.safetyHold)
      };
    });

    const applicantRows = applications.map((application) => {
      const driverId = application.userId || application.id;
      const driver = drivers.find((item) => item.id === driverId) || null;
      const driverVehicles = vehiclesByDriver.get(driverId) || [];
      const selectedVehicle = driverVehicles.find((item) => item.id === driver?.selectedVehicleId && item.status === "approved")
        || driverVehicles.find((item) => item.status === "approved")
        || driverVehicles[0]
        || null;
      const driverDocuments = documentsByDriver.get(driverId) || [];
      const requested = normalizeCapabilities(application.requestedCapabilities || [], selectedVehicle?.type || application.vehicle?.type || "car");
      const readiness = requested.map((capabilityId) => ({
        capabilityId,
        ...capabilityRequirements({
          capabilityId,
          vehicleType: selectedVehicle?.type || application.vehicle?.type || "car",
          documents: driverDocuments,
          application,
          phase: "operational"
        })
      }));
      const readyCapabilities = readiness.filter((item) => item.ready).map((item) => item.capabilityId);
      const activeCapabilities = new Set(Object.entries(driver?.capabilities || {}).filter(([, value]) => (typeof value === "string" ? value : value?.status) === "active").map(([id]) => id));
      const activationReady = readyCapabilities.filter((id) => !activeCapabilities.has(id));
      const updatedMs = millis(application.updatedAt || application.submittedAt || application.createdAt);
      const ageHours = updatedMs ? Math.max(0, Math.floor((now - updatedMs) / 3_600_000)) : null;
      return {
        id: driverId,
        displayName: application.legalName || driver?.displayName || driver?.legalName || "Driver applicant",
        city: application.city || driver?.city || "",
        status: application.status || driver?.status || "application_started",
        ageHours,
        readyCapabilities,
        activationReady,
        requestedCapabilities: requested
      };
    });
    const expiringDocumentRows = documents
      .filter((item) => item.status === "approved" && item.expiresAt)
      .map((item) => ({ ...item, expiresMs: millis(item.expiresAt) }))
      .filter((item) => item.expiresMs > now && item.expiresMs <= now + (30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => a.expiresMs - b.expiresMs)
      .map((item) => {
        const driver = drivers.find((candidate) => candidate.id === item.driverId);
        return {
          id: item.driverId,
          displayName: driver?.displayName || driver?.legalName || applicationMap.get(item.driverId)?.legalName || "Driver",
          documentType: item.type || item.documentType || "document",
          expiresAt: item.expiresAt
        };
      });
    const firstWeekRows = drivers
      .filter((item) => {
        const approvedMs = millis(item.approvedAt || item.activatedAt || item.createdAt);
        return approvedMs && now - approvedMs <= 7 * 24 * 60 * 60 * 1000 && ["ready", "active", "approved"].includes(item.status);
      })
      .map((item) => ({
        id: item.id,
        displayName: item.displayName || item.legalName || "Driver",
        city: item.city || "",
        approvedAt: item.approvedAt || item.activatedAt || item.createdAt,
        work: workByDriver.get(item.id) || null,
        openIncidents: incidentCount.get(item.id) || 0
      }));
    const queues = {
      waitingOnDriver: applicantRows.filter((item) => ["application_started", "information_required"].includes(item.status)),
      waitingOnSpotly: applicantRows.filter((item) => ["application_submitted", "under_review"].includes(item.status)),
      readyForActivation: applicantRows.filter((item) => !["approved", "rejected"].includes(item.status) && item.readyCapabilities.length > 0),
      capabilityActivation: applicantRows.filter((item) => ["approved", "ready", "active"].includes(item.status) && item.activationReady.length > 0),
      expiringDocuments: expiringDocumentRows,
      firstWeekDrivers: firstWeekRows
    };

    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary: {
        drivers: rows.length,
        online: rows.filter((item) => item.online).length,
        dispatchable: rows.filter((item) => item.dispatchable).length,
        busy: rows.filter((item) => item.work).length,
        staleLocation: rows.filter((item) => item.online && ["stale", "missing"].includes(item.locationHealth)).length,
        safetyAttention: rows.filter((item) => item.safetyHold || item.openIncidents > 0).length,
        applicationsWaiting: applications.filter((item) => ["application_submitted", "under_review", "information_required"].includes(item.status)).length,
        waitingOnDriver: queues.waitingOnDriver.length,
        waitingOnSpotly: queues.waitingOnSpotly.length,
        readyForActivation: queues.readyForActivation.length,
        capabilityActivation: queues.capabilityActivation.length,
        expiringDocuments: queues.expiringDocuments.length,
        firstWeekDrivers: queues.firstWeekDrivers.length
      },
      queues,
      drivers: rows,
      activeWork: {
        rides: rides.map((item) => ({ id: item.id, number: item.number, state: item.state, assignedDriverId: item.assignedDriverId || null, pickup: item.pickup || null, dropoff: item.dropoff || null, exceptionCode: item.exceptionCode || null })),
        deliveries: deliveries.map((item) => ({ id: item.id, number: item.number, state: item.state, assignedDriverId: item.assignedDriverId || null, pickup: item.pickup || null, dropoff: item.dropoff || null, fulfilmentMode: item.fulfilmentMode || "merchant_prepared", exceptionCode: item.exceptionCode || null })),
        send: parcels.map((item) => ({ id: item.id, number: item.number, state: item.state, assignedDriverId: item.assignedDriverId || null, pickup: item.pickup || null, dropoff: item.dropoff || null, exceptionCode: item.exceptionCode || null }))
      },
      incidents: incidents.map((item) => ({ id: item.id, driverId: item.driverId, category: item.category, severity: item.severity, status: item.status, createdAt: item.createdAt, rideId: item.rideId || null, deliveryJobId: item.deliveryJobId || null, parcelJobId: item.parcelJobId || null }))
    });
  } catch (error) {
    return apiError(error);
  }
}
