// LX13: Display-only interpretation of already-authorized, bounded Admin snapshots.
// No Firestore access, no success-rate inference, no service mutations and no user identifiers.
const COUNTERS = [
  ["staleDriverPresence", "Stale Driver presence", "Driver locations may need review"],
  ["unresolvedDriverIncidents", "Open Driver safety incidents", "Review incident ownership and safety escalation"],
  ["paymentExceptions", "Payment exceptions", "Reconcile provider and ledger state before taking financial action"],
  ["recentRatePressure", "Recent rate-limit pressure", "Check for abuse or legitimate-client throttling"],
];
function nonnegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function safeName(value) {
  const normalized = String(value || "").trim();
  return /^[a-f0-9]{24}$/i.test(normalized) ? normalized : "unclassified";
}
function validDate(value) {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

export function summarizeIncidentSample(records, { limit = 40 } = {}) {
  const events = Array.isArray(records) ? records.slice(0, 40) : [];
  const groups = new Map();
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const key = safeName(event.fingerprint);
    const existing = groups.get(key) || { fingerprint: key, count: 0, latestAt: null, openObserved: 0, screen: "/", errorClass: "Other" };
    existing.count++;
    if (!["closed", "resolved", "dismissed"].includes(String(event.status || "open").toLowerCase())) existing.openObserved++;
    const time = validDate(event.createdAt);
    if (time !== null && (existing.latestAt === null || time > Date.parse(existing.latestAt))) {
      existing.latestAt = new Date(time).toISOString();
      existing.screen = typeof event.screen === "string" && /^\/[a-z-]{0,32}$/i.test(event.screen) ? event.screen : "/";
      existing.errorClass = ["Error", "TypeError", "NetworkError", "ChunkLoadError", "Other"].includes(event.errorClass) ? event.errorClass : "Other";
    }
    groups.set(key, existing);
  }
  return {
    observed: events.length,
    // A full page cannot prove whether more incidents exist.
    truncatedOrUnknown: events.length >= limit,
    groups: [...groups.values()].sort((a, b) => b.count - a.count || (b.latestAt || "").localeCompare(a.latestAt || "")),
  };
}

export function summarizeOperationsWatch(healthSnapshot, incidentRecords, { incidentsAvailable = true } = {}) {
  const health = healthSnapshot?.health;
  const signals = [];
  if (health && typeof health === "object") {
    signals.push({
      id: "appCheckEnforced", label: "App Check enforcement",
      state: health.appCheckEnforced === true ? "observed" : health.appCheckEnforced === false ? "review" : "unavailable",
      value: health.appCheckEnforced === true ? "Enabled" : health.appCheckEnforced === false ? "Not enabled" : "Unknown",
      detail: "Configuration signal only; signed-client attestation still needs testing",
    });
    for (const [id, label, detail] of COUNTERS) {
      const number = nonnegativeInteger(health[id]);
      signals.push({ id, label, state: number === null ? "unavailable" : number > 0 ? "review" : "observed", value: number, detail });
    }
  }
  const sample = incidentsAvailable ? summarizeIncidentSample(incidentRecords) : null;
  const needsReview = signals.some((signal) => signal.state === "review") || Boolean(sample?.groups.some((group) => group.openObserved > 0));
  return {
    state: !health && !incidentsAvailable ? "unavailable" : needsReview ? "needs_review" : "observed_only",
    generatedAt: healthSnapshot?.generatedAt || null,
    signals,
    incidents: sample,
    // Never say healthy or 0 incidents across the platform based on capped scans.
    limitations: [
      "Health counters come from capped Firestore queries; they are observations, not full-system totals.",
      "Incident groups cover only the latest 40 reports, if Support access is authorized.",
      "No actual uptime, transaction-success rate, billing cost, or response-time SLA is inferred.",
    ],
  };
}
