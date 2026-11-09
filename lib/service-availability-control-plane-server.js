import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { SPOTLY_COUNTRIES } from "./country-engine.js";
import { SERVICE_IDS } from "./contracts/generated.js";
import { marketplaceProfile } from "./marketplace-taxonomy.js";
import { marketplaceTrust } from "./marketplace-trust.js";
import { serviceAvailabilityCityKey } from "./service-availability.js";
import { dispatchHealth } from "./mobility-scheduler-health.js";
import {
  applyServiceAvailabilityDraftEdit,
  buildServiceAvailabilityReadiness,
  materializeServiceAvailabilityRuntimeConfig,
  normalizeServiceAvailabilityConfig,
  publishBlockersForImpact,
  serviceAvailabilityConfigEqual,
  serviceAvailabilityImpact,
  serviceAvailabilityMatrix
} from "./service-availability-control-plane.js";

const GLOBAL_SETTINGS = "global";
const DRAFT_ID = "current";
const REVISION_LIMIT = 40;
const AUDIT_LIMIT = 80;

function valueToIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function docs(snapshot) {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}


function activeConfigFromSettings(settings = {}) {
  return Number(settings.serviceAvailabilityRevisionNumber || 0) > 0
    ? normalizeServiceAvailabilityConfig(settings.serviceAvailability || {})
    : materializeServiceAvailabilityRuntimeConfig(settings);
}

function activeRevisionMeta(settings = {}) {
  return {
    id: settings.serviceAvailabilityRevisionId || null,
    number: Number(settings.serviceAvailabilityRevisionNumber || 0),
    publishedAt: valueToIso(settings.serviceAvailabilityPublishedAt),
    publishedBy: settings.serviceAvailabilityPublishedBy || null,
    publishedByEmail: settings.serviceAvailabilityPublishedByEmail || "",
    note: settings.serviceAvailabilityPublishNote || ""
  };
}

function draftFromDocument(snapshot, settings) {
  if (!snapshot?.exists) {
    return {
      exists: false,
      config: activeConfigFromSettings(settings),
      baseRevisionId: settings.serviceAvailabilityRevisionId || null,
      baseRevisionNumber: Number(settings.serviceAvailabilityRevisionNumber || 0),
      updatedAt: null,
      updatedBy: null,
      updatedByEmail: ""
    };
  }
  const data = snapshot.data() || {};
  return {
    exists: true,
    config: normalizeServiceAvailabilityConfig(data.config || {}),
    baseRevisionId: data.baseRevisionId || null,
    baseRevisionNumber: Number(data.baseRevisionNumber || 0),
    updatedAt: valueToIso(data.updatedAt),
    updatedBy: data.updatedBy || null,
    updatedByEmail: data.updatedByEmail || ""
  };
}

function revisionRecord(doc) {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    number: Number(data.revisionNumber || 0),
    kind: data.kind || "publish",
    publishedAt: valueToIso(data.publishedAt),
    publishedBy: data.publishedBy || null,
    publishedByEmail: data.publishedByEmail || "",
    note: data.note || "",
    previousRevisionId: data.previousRevisionId || null,
    sourceRevisionId: data.sourceRevisionId || null,
    impact: data.impact || {},
    config: normalizeServiceAvailabilityConfig(data.config || {})
  };
}

function auditRecord(doc) {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    action: data.action || "",
    actorId: data.actorId || null,
    actorEmail: data.actorEmail || "",
    entityId: data.entityId || "",
    metadata: data.metadata || {},
    createdAt: valueToIso(data.createdAt)
  };
}

function incrementNested(map, service, country, city, field) {
  map[service] ||= {};
  map[service][country] ||= { discoverable: 0, transactional: 0, cities: {} };
  const countryNode = map[service][country];
  countryNode[field] = Number(countryNode[field] || 0) + 1;
  if (city) {
    const key = String(city).toLowerCase();
    countryNode.cities[key] ||= { discoverable: 0, transactional: 0 };
    countryNode.cities[key][field] = Number(countryNode.cities[key][field] || 0) + 1;
  }
}

function incrementDriver(map, service, country, city) {
  map[service] ||= {};
  map[service][country] ||= { active: 0, cities: {} };
  map[service][country].active += 1;
  if (city) {
    const key = String(city).toLowerCase();
    map[service][country].cities[key] ||= { active: 0 };
    map[service][country].cities[key].active += 1;
  }
}

function capabilityActive(value) {
  return (typeof value === "string" ? value : value?.status) === "active";
}

function platformMobilityFacts(settings = {}, health = {}) {
  const mobility = settings.mobility || {};
  const send = mobility.send || {};
  const routingConfigured = Boolean(String(process.env.SPOTLY_ROUTING_URL || "").trim());
  const geocodingConfigured = Boolean(String(process.env.SPOTLY_GEOCODING_URL || "").trim() && String(process.env.SPOTLY_REVERSE_GEOCODING_URL || "").trim());
  const schedulerSecret = String(process.env.CRON_SECRET || "").trim();
  const rideGeofences = {};
  for (const [key, value] of Object.entries(mobility.cityGeofences || {})) if (value) rideGeofences[key] = true;
  const sendGeofences = {};
  for (const [key, value] of Object.entries(send.cityGeofences || {})) if (value) sendGeofences[key] = true;
  return {
    ride: {
      routingReady: mobility.routingVerified === true && routingConfigured && geocodingConfigured,
      schedulerReady: mobility.dispatchSchedulerVerified === true && schedulerSecret.length >= 24 && dispatchHealth(health.ride || {}).ready,
      pinReady: String(process.env.SPOTLY_RIDE_PIN_KEY || "").length >= 32,
      geofences: rideGeofences
    },
    send: {
      routingReady: send.routingVerified === true && routingConfigured && geocodingConfigured,
      schedulerReady: send.dispatchSchedulerVerified === true && schedulerSecret.length >= 24 && dispatchHealth(health.send || {}).ready,
      pinReady: String(process.env.SPOTLY_SEND_PIN_KEY || "").length >= 32,
      geofences: sendGeofences
    }
  };
}

export async function collectServiceAvailabilityReadinessFacts(db, settings = {}) {
  const [businessesSnapshot, driversSnapshot, applicationsSnapshot, rideHealthSnapshot, sendHealthSnapshot] = await Promise.all([
    db.collection("businesses").where("public", "==", true).limit(700).get().catch(() => ({ docs: [] })),
    db.collection("drivers").limit(500).get().catch(() => ({ docs: [] })),
    db.collection("driverApplications").limit(500).get().catch(() => ({ docs: [] })),
    db.collection("mobilityDispatchHealth").doc("ride").get().catch(() => ({ exists: false, data: () => ({}) })),
    db.collection("mobilityDispatchHealth").doc("send").get().catch(() => ({ exists: false, data: () => ({}) }))
  ]);

  const marketplace = {};
  for (const doc of businessesSnapshot.docs || []) {
    const business = { id: doc.id, ...doc.data() };
    const country = String(business.country || "").toUpperCase();
    if (!SPOTLY_COUNTRIES.some((item) => item.code === country)) continue;
    const service = marketplaceProfile(business).service;
    if (!["eat", "shop", "book", "events"].includes(service)) continue;
    const trust = marketplaceTrust(business);
    if (trust.discoveryAllowed) incrementNested(marketplace, service, country, business.city || "", "discoverable");
    if (trust.commerceVerified) incrementNested(marketplace, service, country, business.city || "", "transactional");
  }

  const applicationCountry = new Map();
  for (const doc of applicationsSnapshot.docs || []) {
    const data = doc.data() || {};
    applicationCountry.set(data.userId || doc.id, { country: String(data.country || "").toUpperCase(), city: String(data.city || "") });
  }

  const drivers = {};
  for (const doc of driversSnapshot.docs || []) {
    const data = doc.data() || {};
    if (!["ready", "active", "approved"].includes(String(data.status || "").toLowerCase())) continue;
    const fallback = applicationCountry.get(doc.id) || {};
    const country = String(data.country || fallback.country || "").toUpperCase();
    const city = String(data.city || fallback.city || "");
    if (!SPOTLY_COUNTRIES.some((item) => item.code === country)) continue;
    const caps = data.capabilities || {};
    if (capabilityActive(caps.ride_passenger)) incrementDriver(drivers, "ride", country, city);
    if (capabilityActive(caps.send)) incrementDriver(drivers, "send", country, city);
  }

  const support = settings.support || {};
  const supportConfigured = Boolean(String(support.hours || "").trim() && [support.email, support.phone, support.whatsapp].some((value) => String(value || "").trim()));
  return { supportConfigured, marketplace, drivers, mobility: platformMobilityFacts(settings, { ride: rideHealthSnapshot.data?.() || {}, send: sendHealthSnapshot.data?.() || {} }) };
}

export async function loadServiceAvailabilityControlPlane(db) {
  const settingsRef = db.collection("platformSettings").doc(GLOBAL_SETTINGS);
  const draftRef = db.collection("serviceAvailabilityDrafts").doc(DRAFT_ID);
  const [settingsSnapshot, draftSnapshot, revisionsSnapshot, auditSnapshot] = await Promise.all([
    settingsRef.get(),
    draftRef.get(),
    db.collection("serviceAvailabilityRevisions").orderBy("revisionNumber", "desc").limit(REVISION_LIMIT).get().catch(() => ({ docs: [] })),
    db.collection("auditLogs").where("entityType", "==", "serviceAvailability").limit(AUDIT_LIMIT).get().catch(() => ({ docs: [] }))
  ]);
  const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
  const activeConfig = activeConfigFromSettings(settings);
  const draft = draftFromDocument(draftSnapshot, settings);
  const facts = await collectServiceAvailabilityReadinessFacts(db, settings);
  const impact = serviceAvailabilityImpact(activeConfig, draft.config);
  const readiness = buildServiceAvailabilityReadiness(draft.config, facts);
  const publishBlockers = publishBlockersForImpact(readiness, impact);
  const stale = draft.exists && (draft.baseRevisionId || null) !== (settings.serviceAvailabilityRevisionId || null);
  const revisions = (revisionsSnapshot.docs || []).map(revisionRecord).sort((a, b) => b.number - a.number);
  const audit = (auditSnapshot.docs || []).map(auditRecord).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return {
    settings,
    active: { config: activeConfig, revision: activeRevisionMeta(settings), matrix: serviceAvailabilityMatrix(activeConfig) },
    draft: { ...draft, matrix: serviceAvailabilityMatrix(draft.config), stale },
    impact,
    readiness,
    publishBlockers,
    revisions,
    audit
  };
}

function auditPayload(actor, action, entityId, metadata = {}) {
  return {
    actorId: actor.uid,
    actorEmail: actor.email || "",
    action,
    entityType: "serviceAvailability",
    entityId,
    metadata,
    createdAt: FieldValue.serverTimestamp()
  };
}

export async function editServiceAvailabilityDraft(db, actor, edit) {
  const settingsRef = db.collection("platformSettings").doc(GLOBAL_SETTINGS);
  const draftRef = db.collection("serviceAvailabilityDrafts").doc(DRAFT_ID);
  await db.runTransaction(async (transaction) => {
    const [settingsSnapshot, draftSnapshot] = await Promise.all([transaction.get(settingsRef), transaction.get(draftRef)]);
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
    const draft = draftFromDocument(draftSnapshot, settings);
    if (draft.exists && (draft.baseRevisionId || null) !== (settings.serviceAvailabilityRevisionId || null)) {
      throw Object.assign(new Error("This draft is based on an older published revision. Reset the draft before editing it further."), { status: 409, code: "stale_service_availability_draft" });
    }
    const next = applyServiceAvailabilityDraftEdit(draft.config, edit);
    transaction.set(draftRef, {
      config: next,
      baseRevisionId: settings.serviceAvailabilityRevisionId || null,
      baseRevisionNumber: Number(settings.serviceAvailabilityRevisionNumber || 0),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email || ""
    }, { merge: false });
    transaction.create(db.collection("auditLogs").doc(), auditPayload(actor, "service_availability.draft_updated", `${edit.service}:${edit.scope}:${edit.country || "default"}:${edit.city || ""}`, {
      service: edit.service,
      scope: edit.scope,
      country: edit.country || null,
      city: edit.city || null,
      state: edit.inherit ? "inherit" : edit.state,
      reason: String(edit.reason || "")
    }));
  });
}

export async function resetServiceAvailabilityDraft(db, actor) {
  const settingsRef = db.collection("platformSettings").doc(GLOBAL_SETTINGS);
  const draftRef = db.collection("serviceAvailabilityDrafts").doc(DRAFT_ID);
  await db.runTransaction(async (transaction) => {
    const settingsSnapshot = await transaction.get(settingsRef);
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
    transaction.set(draftRef, {
      config: activeConfigFromSettings(settings),
      baseRevisionId: settings.serviceAvailabilityRevisionId || null,
      baseRevisionNumber: Number(settings.serviceAvailabilityRevisionNumber || 0),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      updatedByEmail: actor.email || ""
    }, { merge: false });
    transaction.create(db.collection("auditLogs").doc(), auditPayload(actor, "service_availability.draft_reset", "current", { activeRevisionId: settings.serviceAvailabilityRevisionId || null }));
  });
}

export async function publishServiceAvailabilityDraft(db, actor, { note = "" } = {}) {
  const snapshot = await loadServiceAvailabilityControlPlane(db);
  if (!snapshot.draft.exists) throw Object.assign(new Error("There is no saved draft to publish."), { status: 409 });
  if (snapshot.draft.stale) throw Object.assign(new Error("This draft is based on an older published revision. Reset or reapply the changes before publishing."), { status: 409, code: "stale_service_availability_draft" });
  if (!snapshot.impact.changed || serviceAvailabilityConfigEqual(snapshot.active.config, snapshot.draft.config)) throw Object.assign(new Error("The draft does not contain any configuration changes."), { status: 409 });
  if (snapshot.publishBlockers.length) {
    const first = snapshot.publishBlockers[0];
    const detail = first.blockers.map((item) => item.label).join(", ");
    throw Object.assign(new Error(`Cannot publish ${first.service} as live${first.city ? ` in ${first.city}` : ` in ${first.country}`}: ${detail}.`), { status: 409, code: "service_availability_readiness_blocked", blockers: snapshot.publishBlockers });
  }

  const settingsRef = db.collection("platformSettings").doc(GLOBAL_SETTINGS);
  const draftRef = db.collection("serviceAvailabilityDrafts").doc(DRAFT_ID);
  const revisionRef = db.collection("serviceAvailabilityRevisions").doc();
  const normalizedNote = String(note || "").trim().slice(0, 500);
  let publishedNumber = 0;

  await db.runTransaction(async (transaction) => {
    const [settingsSnapshot, draftSnapshot] = await Promise.all([transaction.get(settingsRef), transaction.get(draftRef)]);
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
    const draft = draftFromDocument(draftSnapshot, settings);
    if (!draft.exists) throw Object.assign(new Error("The draft disappeared before it could be published."), { status: 409 });
    if ((draft.baseRevisionId || null) !== (settings.serviceAvailabilityRevisionId || null)) throw Object.assign(new Error("A newer revision was published while this draft was open. Reset the draft and review the impact again."), { status: 409, code: "stale_service_availability_draft" });
    const config = normalizeServiceAvailabilityConfig(draft.config);
    const current = activeConfigFromSettings(settings);
    if (serviceAvailabilityConfigEqual(current, config)) throw Object.assign(new Error("The published configuration already matches this draft."), { status: 409 });
    const impact = serviceAvailabilityImpact(current, config);
    publishedNumber = Number(settings.serviceAvailabilityRevisionNumber || 0) + 1;
    const now = FieldValue.serverTimestamp();
    transaction.create(revisionRef, {
      revisionNumber: publishedNumber,
      kind: "publish",
      config,
      contractVersion: config.version,
      previousRevisionId: settings.serviceAvailabilityRevisionId || null,
      sourceRevisionId: null,
      note: normalizedNote,
      impact: impact.summary,
      publishedAt: now,
      publishedBy: actor.uid,
      publishedByEmail: actor.email || ""
    });
    transaction.set(settingsRef, {
      serviceAvailability: config,
      serviceAvailabilityRevisionId: revisionRef.id,
      serviceAvailabilityRevisionNumber: publishedNumber,
      serviceAvailabilityPublishedAt: now,
      serviceAvailabilityPublishedBy: actor.uid,
      serviceAvailabilityPublishedByEmail: actor.email || "",
      serviceAvailabilityPublishNote: normalizedNote,
      serviceAvailabilityUpdatedAt: now,
      serviceAvailabilityUpdatedBy: actor.uid
    }, { merge: true });
    transaction.delete(draftRef);
    transaction.create(db.collection("auditLogs").doc(), auditPayload(actor, "service_availability.published", revisionRef.id, {
      revisionNumber: publishedNumber,
      previousRevisionId: settings.serviceAvailabilityRevisionId || null,
      note: normalizedNote,
      impact: impact.summary
    }));
  });
  return { revisionId: revisionRef.id, revisionNumber: publishedNumber };
}

export async function rollbackServiceAvailability(db, actor, { revisionId, note = "" } = {}) {
  const targetRef = db.collection("serviceAvailabilityRevisions").doc(String(revisionId || ""));
  const targetSnapshot = await targetRef.get();
  if (!targetSnapshot.exists) throw Object.assign(new Error("That availability revision no longer exists."), { status: 404 });
  const target = revisionRecord(targetSnapshot);
  const control = await loadServiceAvailabilityControlPlane(db);
  if (control.active.revision.id === target.id || serviceAvailabilityConfigEqual(control.active.config, target.config)) throw Object.assign(new Error("That revision is already active."), { status: 409 });
  const impact = serviceAvailabilityImpact(control.active.config, target.config);
  const readiness = buildServiceAvailabilityReadiness(target.config, await collectServiceAvailabilityReadinessFacts(db, control.settings));
  const blockers = publishBlockersForImpact(readiness, impact);
  if (blockers.length) {
    const first = blockers[0];
    throw Object.assign(new Error(`Rollback would make ${first.service} live in a scope whose prerequisites are no longer ready.`), { status: 409, code: "service_availability_readiness_blocked", blockers });
  }

  const settingsRef = db.collection("platformSettings").doc(GLOBAL_SETTINGS);
  const draftRef = db.collection("serviceAvailabilityDrafts").doc(DRAFT_ID);
  const revisionRef = db.collection("serviceAvailabilityRevisions").doc();
  const normalizedNote = String(note || `Rollback to revision ${target.number}`).trim().slice(0, 500);
  let revisionNumber = 0;

  await db.runTransaction(async (transaction) => {
    const settingsSnapshot = await transaction.get(settingsRef);
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
    const current = activeConfigFromSettings(settings);
    revisionNumber = Number(settings.serviceAvailabilityRevisionNumber || 0) + 1;
    const currentImpact = serviceAvailabilityImpact(current, target.config);
    const now = FieldValue.serverTimestamp();
    transaction.create(revisionRef, {
      revisionNumber,
      kind: "rollback",
      config: target.config,
      contractVersion: target.config.version,
      previousRevisionId: settings.serviceAvailabilityRevisionId || null,
      sourceRevisionId: target.id,
      note: normalizedNote,
      impact: currentImpact.summary,
      publishedAt: now,
      publishedBy: actor.uid,
      publishedByEmail: actor.email || ""
    });
    transaction.set(settingsRef, {
      serviceAvailability: target.config,
      serviceAvailabilityRevisionId: revisionRef.id,
      serviceAvailabilityRevisionNumber: revisionNumber,
      serviceAvailabilityPublishedAt: now,
      serviceAvailabilityPublishedBy: actor.uid,
      serviceAvailabilityPublishedByEmail: actor.email || "",
      serviceAvailabilityPublishNote: normalizedNote,
      serviceAvailabilityUpdatedAt: now,
      serviceAvailabilityUpdatedBy: actor.uid
    }, { merge: true });
    transaction.delete(draftRef);
    transaction.create(db.collection("auditLogs").doc(), auditPayload(actor, "service_availability.rolled_back", revisionRef.id, {
      revisionNumber,
      sourceRevisionId: target.id,
      sourceRevisionNumber: target.number,
      previousRevisionId: settings.serviceAvailabilityRevisionId || null,
      note: normalizedNote,
      impact: currentImpact.summary
    }));
  });
  return { revisionId: revisionRef.id, revisionNumber, sourceRevisionId: target.id };
}

export function publicControlPlanePayload(control) {
  return {
    active: control.active,
    draft: control.draft,
    impact: control.impact,
    readiness: control.readiness,
    publishBlockers: control.publishBlockers,
    revisions: control.revisions,
    audit: control.audit,
    services: SERVICE_IDS,
    countries: SPOTLY_COUNTRIES.map((country) => ({ code: country.code, name: country.name, cities: country.cities || [] }))
  };
}
