import "server-only";
import { resolveServiceAvailability, resolveServiceAvailabilitySet, serviceUnavailableMessage } from "./service-availability.js";

export async function loadServiceAvailabilitySettings(db) {
  const snapshot = await db.collection("platformSettings").doc("global").get();
  return snapshot.exists ? snapshot.data() || {} : {};
}

export async function serviceAvailabilityFor(db, context) {
  const settings = await loadServiceAvailabilitySettings(db);
  return { settings, decision: resolveServiceAvailability(settings, context) };
}

export async function serviceAvailabilitySetFor(db, context) {
  const settings = await loadServiceAvailabilitySettings(db);
  return { settings, decisions: resolveServiceAvailabilitySet(settings, context) };
}

export function requireServiceDiscoverable(settings, context) {
  const decision = resolveServiceAvailability(settings, context);
  if (!decision.discoverable) {
    const error = Object.assign(new Error(serviceUnavailableMessage(decision, "discover")), { status: decision.state === "hidden" ? 404 : 409, code: "service_not_discoverable", serviceAvailability: decision });
    throw error;
  }
  return decision;
}

export function requireServiceLive(settings, context) {
  const decision = resolveServiceAvailability(settings, context);
  if (!decision.transactable) {
    const error = Object.assign(new Error(serviceUnavailableMessage(decision, "transact")), { status: decision.state === "hidden" ? 404 : 409, code: "service_not_live", serviceAvailability: decision });
    throw error;
  }
  return decision;
}
