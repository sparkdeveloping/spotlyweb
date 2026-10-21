export const DRIVER_CAPABILITIES = Object.freeze({
  prepared_delivery: {
    id: "prepared_delivery",
    label: "Prepared deliveries",
    shortLabel: "Deliveries",
    description: "Collect prepared restaurant, grocery or retail orders and deliver them.",
    vehicleTypes: ["bicycle", "motorcycle", "car", "van"],
    trainingModules: ["general_safety", "prepared_delivery"],
  },
  shop_and_deliver: {
    id: "shop_and_deliver",
    label: "Shop & Deliver",
    shortLabel: "Shop & Deliver",
    description: "Shop customer baskets in participating stores, reconcile checkout and deliver them.",
    vehicleTypes: ["bicycle", "motorcycle", "car", "van"],
    trainingModules: ["general_safety", "shop_and_deliver"],
  },
  send: {
    id: "send",
    label: "Send",
    shortLabel: "Send",
    description: "Collect and deliver parcels with secure pickup and recipient handoff.",
    vehicleTypes: ["bicycle", "motorcycle", "car", "van"],
    trainingModules: ["general_safety", "send"],
  },
  ride_passenger: {
    id: "ride_passenger",
    label: "Passenger rides",
    shortLabel: "Rides",
    description: "Pick up riders and complete approved passenger trips.",
    vehicleTypes: ["car", "van"],
    trainingModules: ["general_safety", "ride_passenger"],
  },
  bulky_delivery: {
    id: "bulky_delivery",
    label: "Bulky deliveries",
    shortLabel: "Bulky",
    description: "Move larger orders that require an approved van or capacity-rated vehicle.",
    vehicleTypes: ["van"],
    trainingModules: ["general_safety", "bulky_delivery"],
  },
});

export const DRIVER_TRAINING_MODULES = Object.freeze({
  general_safety: { id: "general_safety", version: 1, label: "Driver safety & privacy", minutes: 4, lessons: ["Use the Driver app only when you are safely stopped.", "Keep customer, rider and merchant information private.", "Use the Safety tools immediately when a situation feels unsafe."], check: { question: "If the app needs attention while you are driving, what should you do?", options: ["Stop safely before using the app", "Keep driving and type quickly", "Ask the customer to operate your phone"], answer: 0 } },
  prepared_delivery: { id: "prepared_delivery", version: 1, label: "Prepared order pickup & handoff", minutes: 4, lessons: ["A prepared delivery is collected from the merchant; you do not shop the basket.", "If an order is not ready, use the wait/problem action instead of pretending it was collected.", "Check the package count and obvious damage before leaving pickup."], check: { question: "The restaurant says the order needs 12 more minutes. What should you do?", options: ["Mark it collected so the customer sees progress", "Use the order-not-ready action and wait safely", "Cancel it without telling Spotly"], answer: 1 } },
  shop_and_deliver: { id: "shop_and_deliver", version: 1, label: "Shopping, substitutions & checkout", minutes: 5, lessons: ["Follow the customer substitution preference for every unavailable item.", "Never use your own money for a Spotly-funded basket.", "Do not finalize shopping until the merchant checkout authorization and receipt steps are complete."], check: { question: "An item is unavailable and the customer chose ‘contact me’. What should you do?", options: ["Choose any similar item", "Remove every unavailable item automatically", "Propose a replacement and wait for the customer decision"], answer: 2 } },
  send: { id: "send", version: 1, label: "Parcel safety, PINs & failed handoff", minutes: 4, lessons: ["Confirm the parcel matches the declared size and description before pickup.", "Use pickup and recipient PINs only at the correct handoff stage.", "Report suspicious, prohibited, damaged or materially different parcels before continuing."], check: { question: "The parcel is materially different from what the job describes. What should you do?", options: ["Collect it anyway", "Report the mismatch before pickup", "Change the description yourself"], answer: 1 } },
  ride_passenger: { id: "ride_passenger", version: 1, label: "Passenger pickup, no-show & ride safety", minutes: 5, lessons: ["Confirm the correct rider before starting the trip.", "Use the rider-not-here workflow instead of starting a trip without the rider.", "Use Safety immediately for an unsafe rider, crash or serious vehicle issue."], check: { question: "You arrive but cannot find the rider. What should you do?", options: ["Start the trip so the timer counts", "Use the rider-not-here workflow and follow the wait guidance", "Leave and complete the ride"], answer: 1 } },
  bulky_delivery: { id: "bulky_delivery", version: 1, label: "Load size, handling & assistance", minutes: 4, lessons: ["Check size, weight and loading notes before accepting or loading.", "Do not exceed your approved vehicle or safe handling capacity.", "Use the problem flow when loading assistance or a different vehicle is required."], check: { question: "The load is larger than your approved vehicle can safely carry. What should you do?", options: ["Try to fit it anyway", "Carry part of it without telling Spotly", "Do not load it; report the capacity problem"], answer: 2 } },
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

export function trainingRequirementsFor(capabilities = []) {
  const modules = new Set();
  normalizeCapabilities(capabilities).forEach((id) => DRIVER_CAPABILITIES[id]?.trainingModules?.forEach((moduleId) => modules.add(moduleId)));
  return [...modules];
}

export function trainingModuleIsCurrent(application = {}, moduleId) {
  const requiredVersion = Number(DRIVER_TRAINING_MODULES[moduleId]?.version || 1);
  const stored = application.trainingModules?.[moduleId];
  if (stored === true) return requiredVersion === 1; // Legacy per-module completion is valid for the original module only.
  if (!stored && application.trainingComplete === true) return requiredVersion === 1; // Legacy global completion does not bypass future retraining.
  if (!stored || typeof stored !== "object" || stored.completed !== true) return false;
  return Number(stored.version || 0) >= requiredVersion;
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


export function validDriverPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  const national = digits.startsWith("263") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[1-9]\d{7,8}$/.test(national);
}

const APPLICATION_VEHICLE_TYPES = new Set(["bicycle", "motorcycle", "car", "van"]);

export function requirementPlan({ application = {}, vehicle = null, documents = [], payoutAccount = undefined, phase = "application" } = {}) {
  const vehicleType = vehicle?.type || "";
  const requested = Array.isArray(application.requestedCapabilities) ? [...new Set(application.requestedCapabilities)] : [];
  const capabilities = requested.filter((id) => DRIVER_CAPABILITIES[id] && capabilitySupportsVehicle(id, vehicleType));
  const documentTypes = documentRequirementsFor({ vehicleType, capabilities });
  const trainingModules = capabilities.length ? trainingRequirementsFor(capabilities) : [];
  const motorized = MOTORIZED.has(vehicleType);
  const savedPayout = payoutAccount === undefined ? Boolean(application.payoutComplete) :
    Boolean(payoutAccount && ["bank", "mobile_money"].includes(payoutAccount.type) &&
      String(payoutAccount.provider || "").trim().length >= 2 &&
      String(payoutAccount.recipientName || "").trim().length >= 2 &&
      payoutAccount.maskedIdentifier && payoutAccount.verificationState !== "rejected");
  const payoutReady = savedPayout && (phase !== "operational" || payoutAccount === undefined || payoutAccount?.verificationState === "verified");
  const checks = [
    { id: "identity", type: "profile", step: 0, label: "Full legal name", action: "Add your full legal name.", ok: String(application.legalName || "").trim().length >= 2, owner: "driver" },
    { id: "phone", type: "profile", step: 0, label: "Driver phone number", action: "Add a valid Zimbabwe phone number.", ok: validDriverPhone(application.phone), owner: "driver" },
    { id: "city", type: "profile", step: 0, label: "City", action: "Choose your work city.", ok: Boolean(String(application.city || "").trim()), owner: "driver" },
    { id: "emergency_contact", type: "profile", step: 0, label: "Emergency contact", action: "Add your emergency contact's name.", ok: String(application.emergencyContactName || "").trim().length >= 2, owner: "driver" },
    { id: "emergency_phone", type: "profile", step: 0, label: "Emergency contact phone", action: "Add a valid emergency contact phone number.", ok: validDriverPhone(application.emergencyContactPhone), owner: "driver" },
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
    ...trainingModules.map((moduleId) => ({ id: `training_${moduleId}`, type: "training", step: 5, moduleId,
      label: DRIVER_TRAINING_MODULES[moduleId]?.label || moduleId, action: "Complete this training module.",
      ok: trainingModuleIsCurrent(application, moduleId), owner: "driver" })),
    { id: "agreements", type: "agreements", step: 5, label: "Driver terms and location consent",
      action: "Accept the Driver terms and location consent.", ok: Boolean(application.agreementsAccepted && application.locationConsent), owner: "driver" },
  ];
  return { vehicleType, capabilities, documentTypes, trainingModules, checks, complete: checks.every((item) => item.ok) };
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
    ...definition.trainingModules.map((moduleId) => ({ id: `training_${moduleId}`, label: `${DRIVER_TRAINING_MODULES[moduleId]?.label || moduleId} complete`, ok: trainingModuleIsCurrent(application, moduleId) })),
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
