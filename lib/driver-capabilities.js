import { validDriverContactPhone, validCountry } from "./driver-regions.js";

import { countryDefinition } from "./country-engine.js";
export const DRIVER_CAPABILITIES = Object.freeze({
  prepared_delivery: {
    id: "prepared_delivery",
    label: "Prepared deliveries",
    shortLabel: "Deliveries",
    description: "Collect prepared restaurant, grocery or retail orders and deliver them.",
    vehicleTypes: ["bicycle", "motorcycle", "car", "van"],
  },
  shop_and_deliver: {
    id: "shop_and_deliver",
    label: "Shop & Deliver",
    shortLabel: "Shop & Deliver",
    description: "Shop customer baskets in participating stores, reconcile checkout and deliver them.",
    vehicleTypes: ["bicycle", "motorcycle", "car", "van"],
  },
  send: {
    id: "send",
    label: "Send",
    shortLabel: "Send",
    description: "Collect and deliver parcels with secure pickup and recipient handoff.",
    vehicleTypes: ["bicycle", "motorcycle", "car", "van"],
  },
  ride_passenger: {
    id: "ride_passenger",
    label: "Passenger rides",
    shortLabel: "Rides",
    description: "Pick up riders and complete approved passenger trips.",
    vehicleTypes: ["car", "van"],
  },
  bulky_delivery: {
    id: "bulky_delivery",
    label: "Bulky deliveries",
    shortLabel: "Bulky",
    description: "Move larger orders that require an approved van or capacity-rated vehicle.",
    vehicleTypes: ["van"],
  },
});

const MOTORIZED = new Set(["motorcycle", "car", "van"]);
const VEHICLE_SCOPED_DOCUMENTS = new Set(["registration", "insurance", "vehicle_fitness"]);

export function normalizeCapabilities(values = [], vehicleType = "") {
  const requested = Array.isArray(values) ? values.filter((id) => DRIVER_CAPABILITIES[id]) : [];
  if (requested.length) return [...new Set(requested)];
  const fallback = ["prepared_delivery", "send", "shop_and_deliver"];
  if (["car", "van"].includes(vehicleType)) fallback.push("ride_passenger");
  if (vehicleType === "van") fallback.push("bulky_delivery");
  return fallback;
}

export function capabilityForWorkType(workType, fulfilmentMode = "") {
  if (workType === "ride") return "ride_passenger";
  if (workType === "send" || workType === "parcel") return "send";
  if (workType === "delivery" && fulfilmentMode === "driver_shops") return "shop_and_deliver";
  if (workType === "delivery") return "prepared_delivery";
  return workType && DRIVER_CAPABILITIES[workType] ? workType : "prepared_delivery";
}

export function capabilitySupportsVehicle(capabilityId, vehicleType) {
  return Boolean(DRIVER_CAPABILITIES[capabilityId]?.vehicleTypes?.includes(vehicleType));
}

export function documentRequirementsFor({ vehicleType = "", capabilities = [] } = {}) {
  const required = new Set(["identity"]);
  if (MOTORIZED.has(vehicleType)) {
    required.add("licence");
    required.add("registration");
  }
  if (capabilities.includes("ride_passenger")) {
    required.add("licence");
    required.add("registration");
    required.add("insurance");
    required.add("vehicle_fitness");
  }
  return [...required];
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function documentState(documents, type, phase, vehicleId = "") {
  const vehicleScoped = VEHICLE_SCOPED_DOCUMENTS.has(type);
  const matching = documents.filter((item) => {
    if (item.type !== type) return false;
    if (!vehicleScoped || !vehicleId) return true;
    if (item.vehicleId === vehicleId) return true;
    // Backward compatibility for the original primary vehicle before documents were scoped.
    return vehicleId.endsWith("_primary") && !item.vehicleId;
  }).sort((a, b) => (dateValue(b.updatedAt || b.uploadedAt) || 0) - (dateValue(a.updatedAt || a.uploadedAt) || 0));
  const current = matching[0] || null;
  if (!current) return { ok: false, status: "missing", document: null };
  const expiresAt = dateValue(current.expiresAt);
  if (expiresAt && expiresAt <= Date.now()) return { ok: false, status: "expired", document: current };
  if (current.status === "rejected") return { ok: false, status: "rejected", document: current };
  if (phase === "operational") return { ok: current.status === "approved", status: current.status || "uploaded", document: current };
  return { ok: ["uploaded", "approved", "pending_review"].includes(current.status), status: current.status || "uploaded", document: current };
}


export function validDriverPhone(value = "", countryCode = "") {
  if (!validCountry(countryCode)) return false;
  return validDriverContactPhone(value, countryCode);
}

const APPLICATION_VEHICLE_TYPES = new Set(["bicycle", "motorcycle", "car", "van"]);

export function requirementPlan({ application = {}, vehicle = null, documents = [], payoutAccount = undefined, phase = "application" } = {}) {
  const vehicleType = vehicle?.type || "";
  const requested = Array.isArray(application.requestedCapabilities) ? [...new Set(application.requestedCapabilities)] : [];
  const capabilities = requested.filter((id) => DRIVER_CAPABILITIES[id] && capabilitySupportsVehicle(id, vehicleType));
  const documentTypes = documentRequirementsFor({ vehicleType, capabilities });
  const motorized = MOTORIZED.has(vehicleType);
  const savedPayout = payoutAccount === undefined ? Boolean(application.payoutComplete) :
    Boolean(payoutAccount && ["bank", "mobile_money"].includes(payoutAccount.type) &&
      String(payoutAccount.provider || "").trim().length >= 2 &&
      String(payoutAccount.recipientName || "").trim().length >= 2 &&
      payoutAccount.maskedIdentifier && payoutAccount.verificationState !== "rejected");
  const payoutReady = savedPayout && (phase !== "operational" || payoutAccount === undefined || payoutAccount?.verificationState === "verified");
  const checks = [
    { id: "country", type: "profile", step: 0, label: "Country of operation", action: "Choose your operating country.", ok: phase === "operational" || validCountry(application.country), owner: "driver" },
    { id: "identity", type: "profile", step: 0, label: "Full legal name", action: "Add your full legal name.", ok: String(application.legalName || "").trim().length >= 2, owner: "driver" },
    { id: "phone", type: "profile", step: 0, label: "Driver phone number", action: "Add a valid phone number for your selected country.", ok: validDriverPhone(application.phone, application.country), owner: "driver" },
    { id: "city", type: "profile", step: 0, label: "City", action: "Choose your work city.", ok: Boolean(String(application.city || "").trim()), owner: "driver" },
    { id: "emergency_contact", type: "profile", step: 0, label: "Emergency contact", action: "Add your emergency contact's name.", ok: String(application.emergencyContactName || "").trim().length >= 2, owner: "driver" },
    { id: "emergency_phone", type: "profile", step: 0, label: "Emergency contact phone", action: "Add a valid emergency contact phone number.", ok: validDriverPhone(application.emergencyContactPhone, application.country), owner: "driver" },
    { id: "work", type: "capabilities", step: 1, label: "Work types selected", action: "Choose a work type compatible with your vehicle.", ok: requested.length > 0 && requested.length === capabilities.length, owner: "driver" },
    { id: "vehicle", type: "vehicle", step: 1, label: "Vehicle added", action: "Save your vehicle details.", ok: Boolean(vehicle?.id && APPLICATION_VEHICLE_TYPES.has(vehicleType)), owner: "driver" },
    ...(motorized ? [
      { id: "vehicle_registration", type: "vehicle", step: 1, label: "Vehicle registration", action: "Add your motor vehicle registration.", ok: String(vehicle?.registration || "").trim().length >= 2, owner: "driver" },
      { id: "vehicle_make", type: "vehicle", step: 1, label: "Vehicle make", action: "Add your vehicle make.", ok: Boolean(String(vehicle?.make || "").trim()), owner: "driver" },
      { id: "vehicle_model", type: "vehicle", step: 1, label: "Vehicle model", action: "Add your vehicle model.", ok: Boolean(String(vehicle?.model || "").trim()), owner: "driver" }
    ] : []),
    ...documentTypes.map((type) => {
      const state = documentState(documents, type, phase, vehicle?.id || "");
      const label = type === "identity" ? "Identification" : type === "licence" ? "Driver licence" : type === "vehicle_fitness" ? "Vehicle fitness / inspection" : `Vehicle ${type}`;
      return { id: `document_${type}`, type: "document", step: 2, documentType: type, label,
        action: state.status === "expired" ? `Replace expired ${label.toLowerCase()}.` :
          state.status === "rejected" ? `Replace rejected ${label.toLowerCase()}.` : `Upload ${label.toLowerCase()}.`,
        ok: state.ok, status: state.status, reviewReason: state.document?.reviewReason || "",
        owner: state.status === "uploaded" || state.status === "pending_review" ? "spotly" : "driver" };
    }),
    { id: "payout", type: "money", step: 4, label: "Payout destination saved", action: "Save valid payout details.", ok: payoutReady, owner: "driver" },
    { id: "agreements", type: "agreements", step: 5, label: "Driver terms and location consent",
      action: "Accept the Driver terms and location consent.", ok: Boolean(application.agreementsAccepted && application.locationConsent), owner: "driver" },
  ];
  return { vehicleType, capabilities, documentTypes, checks, complete: checks.every((item) => item.ok) };
}

export function capabilityRequirements({ capabilityId, vehicleType, vehicleId = "", documents = [], application = {}, phase = "operational" } = {}) {
  const definition = DRIVER_CAPABILITIES[capabilityId];
  if (!definition) return { capabilityId, supported: false, checks: [], ready: false };
  const docTypes = documentRequirementsFor({ vehicleType, capabilities: [capabilityId] });
  const checks = [
    { id: "vehicle_compatibility", label: `${definition.shortLabel} supported by this vehicle`, ok: capabilitySupportsVehicle(capabilityId, vehicleType) },
    ...docTypes.map((type) => {
      const state = documentState(documents, type, phase, vehicleId);
      return { id: `document_${type}`, label: type === "identity" ? "Identification valid" : type === "licence" ? "Driver licence valid" : type === "vehicle_fitness" ? "Vehicle fitness valid" : `${type.replaceAll("_", " ")} valid`, ok: state.ok, status: state.status };
    }),
  ];
  return { capabilityId, supported: true, checks, ready: checks.every((item) => item.ok) };
}

export function storedCapabilityStatus(driver = {}, capabilityId, { vehicleType = "", requestedCapabilities = [] } = {}) {
  const raw = driver.capabilities?.[capabilityId];
  if (typeof raw === "string") return raw;
  if (raw?.status) return raw.status;
  if (!["approved", "ready", "active"].includes(driver.status)) return "not_active";
  const requested = normalizeCapabilities(requestedCapabilities, vehicleType);
  if (!requested.includes(capabilityId) || !capabilitySupportsVehicle(capabilityId, vehicleType)) return "not_requested";
  return "active";
}

export function capabilitySummary({ driver = {}, application = {}, vehicle = null, documents = [] } = {}) {
  const vehicleType = vehicle?.type || "";
  const requested = normalizeCapabilities(application.requestedCapabilities || driver.requestedCapabilities || [], vehicleType);
  return requested.map((capabilityId) => {
    const definition = DRIVER_CAPABILITIES[capabilityId];
    const requirements = capabilityRequirements({ capabilityId, vehicleType, vehicleId: vehicle?.id || "", documents, application, phase: driver?.status ? "operational" : "application" });
    const storedStatus = storedCapabilityStatus(driver, capabilityId, { vehicleType, requestedCapabilities: requested });
    const status = storedStatus === "active" && !requirements.ready ? "blocked" : storedStatus;
    return { id: capabilityId, label: definition.label, shortLabel: definition.shortLabel, description: definition.description, status, ready: status === "active" && requirements.ready, requirements: requirements.checks };
  });
}
