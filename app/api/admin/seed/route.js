import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";
import { zimbabweBusinesses } from "@/data/zimbabwe-businesses";
import { defaultRoleTemplates, defaultHelpResources } from "@/data/production-seed";
import { groceryCatalogTemplates } from "@/data/catalog-templates";

export const runtime = "nodejs";

function slug(value = "") {
  return String(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function searchTerms(...values) {
  const text = values.flat(Infinity).filter(Boolean).join(" ").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, " ");
  const words = text.split(/\s+/).filter(Boolean);
  const terms = new Set();
  words.forEach((word) => {
    terms.add(word);
    for (let index = 2; index <= Math.min(18, word.length); index += 1) terms.add(word.slice(0, index));
  });
  return [...terms].slice(0, 180);
}

async function commitInChunks(db, records, writer, chunkSize = 380) {
  for (let start = 0; start < records.length; start += chunkSize) {
    const batch = db.batch();
    records.slice(start, start + chunkSize).forEach((record) => writer(batch, record));
    await batch.commit();
  }
}

function preparedDirectory() {
  const groups = new Map();
  const records = zimbabweBusinesses.map((listing) => {
    const organizationId = `org-${slug(listing.brandName || listing.name)}`;
    const branchId = `branch-${listing.id}`;
    if (!groups.has(organizationId)) {
      groups.set(organizationId, {
        id: organizationId,
        name: listing.brandName || listing.name,
        businessIds: [],
        branchIds: [],
        source: listing.source
      });
    }
    const group = groups.get(organizationId);
    group.businessIds.push(listing.id);
    group.branchIds.push(branchId);

    return {
      business: {
        ...listing,
        organizationId,
        branchIds: [branchId],
        searchTerms: searchTerms(listing.name, listing.brandName, listing.branchName, listing.category, listing.city, listing.aliases),
        directoryRecord: true,
        directoryVersion: 3,
        seeded: true
      },
      branch: {
        id: branchId,
        organizationId,
        businessId: listing.id,
        name: listing.branchName && listing.branchName !== "Main" ? `${listing.brandName || listing.name} — ${listing.branchName}` : listing.name,
        city: listing.city || "Harare",
        address: listing.address || "",
        phone: listing.phone || "",
        email: listing.email || "",
        public: listing.public !== false,
        status: "provisional",
        fulfilment: listing.fulfilment || [],
        openingHours: {
          monday: { open: "08:00", close: "17:00", closed: false },
          tuesday: { open: "08:00", close: "17:00", closed: false },
          wednesday: { open: "08:00", close: "17:00", closed: false },
          thursday: { open: "08:00", close: "17:00", closed: false },
          friday: { open: "08:00", close: "17:00", closed: false },
          saturday: { open: "08:00", close: "14:00", closed: false },
          sunday: { open: "", close: "", closed: true }
        },
        pickup: { enabled: (listing.fulfilment || []).includes("pickup"), slotMinutes: 30, slotCapacity: 12, preparationMinutes: 45 },
        acceptedCurrencies: ["USD", "ZWG"],
        paymentMethods: ["cash", "paynow", "ecocash", "onemoney", "card", "bank_transfer"],
        source: listing.source,
        searchTerms: searchTerms(listing.name, listing.brandName, listing.branchName, listing.city, listing.address),
        directoryRecord: true,
        directoryVersion: 3,
        seeded: true
      }
    };
  });

  const organizations = [...groups.values()].map((group) => ({
    ...group,
    status: "provisional",
    ownerIds: [],
    country: "ZW",
    directoryRecord: true,
    directoryVersion: 3,
    seeded: true,
    searchTerms: searchTerms(group.name)
  }));
  return { records, organizations };
}

async function existingDocumentIds(db, collectionName, ids) {
  const found = new Set();
  for (let start = 0; start < ids.length; start += 200) {
    const references = ids.slice(start, start + 200).map((id) => db.collection(collectionName).doc(id));
    const snapshots = await db.getAll(...references);
    snapshots.forEach((snapshot) => { if (snapshot.exists) found.add(snapshot.id); });
  }
  return found;
}

async function counts(db) {
  const names = ["businesses", "branches", "organizations", "roleTemplates", "helpResources", "catalogTemplates"];
  const values = await Promise.all(names.map(async (name) => {
    const snapshot = await db.collection(name).count().get();
    return [name, snapshot.data().count];
  }));
  const status = await db.collection("systemStatus").doc("directorySeed").get();
  return { ...Object.fromEntries(values), seed: status.exists ? status.data() : null };
}

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ["super_admin", "platform_admin", "operations_manager", "data_import_manager"] });
    const { db } = getAdminServices();
    return Response.json({ ok: true, ...(await counts(db)), expectedBusinesses: zimbabweBusinesses.length });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ["super_admin", "platform_admin", "data_import_manager"] });
    const { db } = getAdminServices();
    const body = await request.json().catch(() => ({}));
    const includeBusinesses = body.includeBusinesses !== false;
    const startedAt = new Date().toISOString();
    await db.collection("systemStatus").doc("directorySeed").set({ status: "running", startedAt, startedBy: actor.uid, expectedBusinesses: includeBusinesses ? zimbabweBusinesses.length : 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("platformSettings").doc("global").set({ ...DEFAULT_PLATFORM_SETTINGS, seededAt: FieldValue.serverTimestamp(), seededBy: actor.uid }, { merge: true });

    await commitInChunks(db, defaultRoleTemplates, (batch, role) => batch.set(db.collection("roleTemplates").doc(role.id), { ...role, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true }));
    await commitInChunks(db, defaultHelpResources, (batch, resource) => batch.set(db.collection("helpResources").doc(resource.id), { ...resource, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true }));
    await commitInChunks(db, groceryCatalogTemplates, (batch, template) => batch.set(db.collection("catalogTemplates").doc(template.id), { ...template, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true }));

    let branchCount = 0;
    let organizationCount = 0;
    if (includeBusinesses) {
      const directory = preparedDirectory();
      const [existingBusinesses, existingBranches, existingOrganizations] = await Promise.all([
        existingDocumentIds(db, "businesses", directory.records.map((record) => record.business.id)),
        existingDocumentIds(db, "branches", directory.records.map((record) => record.branch.id)),
        existingDocumentIds(db, "organizations", directory.organizations.map((organization) => organization.id))
      ]);
      await commitInChunks(db, directory.organizations, (batch, organization) => {
        const reference = db.collection("organizations").doc(organization.id);
        const payload = existingOrganizations.has(organization.id)
          ? { directoryRecord: true, directoryVersion: 3, seeded: true, seedSource: organization.source || null, lastSeededAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
          : { ...organization, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastSeededAt: FieldValue.serverTimestamp() };
        batch.set(reference, payload, { merge: true });
      });
      await commitInChunks(db, directory.records, (batch, record) => {
        const businessReference = db.collection("businesses").doc(record.business.id);
        const branchReference = db.collection("branches").doc(record.branch.id);
        const businessPayload = existingBusinesses.has(record.business.id)
          ? { directoryRecord: true, directoryVersion: 3, seeded: true, seedSource: record.business.source || null, lastSeededAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
          : { ...record.business, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastSeededAt: FieldValue.serverTimestamp() };
        const branchPayload = existingBranches.has(record.branch.id)
          ? { directoryRecord: true, directoryVersion: 3, seeded: true, seedSource: record.branch.source || null, lastSeededAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
          : { ...record.branch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastSeededAt: FieldValue.serverTimestamp() };
        batch.set(businessReference, businessPayload, { merge: true });
        batch.set(branchReference, branchPayload, { merge: true });
      }, 240);
      branchCount = directory.records.length;
      organizationCount = directory.organizations.length;
    }

    const result = { businesses: includeBusinesses ? zimbabweBusinesses.length : 0, branches: branchCount, organizations: organizationCount, roles: defaultRoleTemplates.length, helpResources: defaultHelpResources.length, catalogTemplates: groceryCatalogTemplates.length };
    await db.collection("systemStatus").doc("directorySeed").set({ status: "complete", ...result, completedAt: FieldValue.serverTimestamp(), completedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("auditLogs").add({ action: "platform.seeded", entityType: "platform", entityId: "global", actorId: actor.uid, actorEmail: actor.email || "", metadata: result, createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    try {
      const { db } = getAdminServices();
      await db.collection("systemStatus").doc("directorySeed").set({ status: "failed", error: error.message || "Seed failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch {}
    return apiError(error);
  }
}
