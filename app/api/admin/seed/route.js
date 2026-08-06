import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";
import { zimbabweBusinesses } from "@/data/zimbabwe-businesses";
import { defaultRoleTemplates, defaultHelpResources } from "@/data/production-seed";
import { groceryCatalogTemplates } from "@/data/catalog-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function businessType(category = "") {
  const value = category.toLowerCase();
  if (["groceries", "retail", "pharmacy", "fashion", "home", "hardware", "agriculture"].some((item) => value.includes(item))) return "grocery_retail";
  if (value.includes("restaurant") || value.includes("food")) return "restaurant_food";
  if (value.includes("event")) return "ticketing_events";
  if (["beauty", "wellness", "health", "professional", "education"].some((item) => value.includes(item))) return "appointments_services";
  if (["accommodation", "activities"].some((item) => value.includes(item))) return "accommodation_activities";
  return "directory_profile";
}

function capabilities(type) {
  const values = {
    grocery_retail: ["catalog", "inventory", "pickup_orders", "promotions", "kiosk_pickup"],
    restaurant_food: ["menu", "pickup_orders", "preparation", "promotions", "kiosk_ordering"],
    ticketing_events: ["events", "tickets", "attendees", "kiosk_checkin", "promotions"],
    appointments_services: ["services", "appointments", "staff_schedules", "promotions", "kiosk_checkin"],
    accommodation_activities: ["listings", "bookings", "capacity", "promotions", "kiosk_checkin"],
    directory_profile: ["profile", "enquiries"]
  };
  return values[type] || values.directory_profile;
}

async function commitInChunks(db, records, writer, chunkSize = 380) {
  for (let start = 0; start < records.length; start += chunkSize) {
    const batch = db.batch();
    records.slice(start, start + chunkSize).forEach((record) => writer(batch, record));
    await batch.commit();
  }
}

function branchDisplayName(listing, groupSize) {
  const branchName = String(listing.branchName || "").trim();
  if (branchName && !["main", "main branch"].includes(branchName.toLowerCase())) return branchName;
  if (groupSize > 1 && listing.city) return listing.city;
  return "Main location";
}

function preparedDirectory() {
  const groups = new Map();
  zimbabweBusinesses.forEach((listing) => {
    const brandId = listing.brandId || slug(listing.brandName || listing.name);
    if (!groups.has(brandId)) groups.set(brandId, []);
    groups.get(brandId).push(listing);
  });

  const businesses = [];
  const branches = [];
  const organizations = [];
  const legacyMap = new Map();

  groups.forEach((listings, brandId) => {
    const first = listings[0];
    const organizationId = `org-${brandId}`;
    const businessId = `business-${brandId}`;
    const branchIds = listings.map((listing) => `branch-${listing.id}`);
    const cities = [...new Set(listings.map((listing) => listing.city).filter(Boolean))].sort();
    const type = businessType(first.category);

    businesses.push({
      id: businessId,
      organizationId,
      name: first.brandName || first.name,
      brandName: first.brandName || first.name,
      category: first.category,
      categories: [first.category],
      businessType: type,
      capabilities: capabilities(type),
      operatingModel: listings.length > 1 ? "physical_multi" : "physical_single",
      country: "ZW",
      city: cities[0] || "Zimbabwe",
      cities,
      branchIds,
      branchCount: branchIds.length,
      public: true,
      status: "provisional",
      claimStatus: "unclaimed",
      verificationStatus: "unverified",
      description: `${first.brandName || first.name} is listed provisionally for discovery and claiming. The business can confirm or correct every detail.`,
      phone: first.phone || "",
      email: first.email || "",
      website: first.website || "",
      source: first.source,
      searchTerms: searchTerms(first.brandName, first.name, first.category, cities, listings.flatMap((item) => item.aliases || [])),
      aliases: [...new Set(listings.flatMap((item) => [item.brandName, item.name, ...(item.aliases || [])]).filter(Boolean))],
      onboardingStatus: "not_started",
      directoryRecord: true,
      directoryVersion: 4,
      seeded: true
    });

    organizations.push({
      id: organizationId,
      name: first.brandName || first.name,
      businessIds: [businessId],
      branchIds,
      ownerIds: [],
      status: "provisional",
      country: "ZW",
      source: first.source,
      searchTerms: searchTerms(first.brandName, first.name),
      directoryRecord: true,
      directoryVersion: 4,
      seeded: true
    });

    listings.forEach((listing) => {
      const branchId = `branch-${listing.id}`;
      const displayName = branchDisplayName(listing, listings.length);
      legacyMap.set(listing.id, businessId);
      branches.push({
        id: branchId,
        organizationId,
        businessId,
        name: displayName,
        branchName: displayName,
        displayName,
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
        searchTerms: searchTerms(displayName, listing.name, listing.brandName, listing.city, listing.address),
        directoryRecord: true,
        directoryVersion: 4,
        seeded: true
      });
    });
  });

  return { businesses, branches, organizations, legacyMap };
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

async function migrateLegacyDirectory(db, directory) {
  const legacyIds = [...directory.legacyMap.keys()];
  const legacySnapshots = [];
  for (let start = 0; start < legacyIds.length; start += 200) {
    const snapshots = await db.getAll(...legacyIds.slice(start, start + 200).map((id) => db.collection("businesses").doc(id)));
    legacySnapshots.push(...snapshots.filter((snapshot) => snapshot.exists));
  }

  const ownership = new Map();
  legacySnapshots.forEach((snapshot) => {
    const canonicalId = directory.legacyMap.get(snapshot.id);
    const data = snapshot.data();
    if (!ownership.has(canonicalId)) ownership.set(canonicalId, { ownerIds: new Set(), claimed: false, verified: false });
    const value = ownership.get(canonicalId);
    (data.ownerIds || []).forEach((id) => value.ownerIds.add(id));
    if (data.claimStatus === "claimed") value.claimed = true;
    if (data.verificationStatus === "approved") value.verified = true;
  });

  if (legacySnapshots.length) {
    await commitInChunks(db, legacySnapshots, (batch, snapshot) => {
      const canonicalBusinessId = directory.legacyMap.get(snapshot.id);
      batch.set(snapshot.ref, { public: false, status: "archived", canonicalBusinessId, directoryVersion: 3, archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }, 300);
  }

  const memberships = await db.collection("memberships").get();
  const membershipUpdates = memberships.docs.map((snapshot) => {
    const data = snapshot.data();
    const mapped = (data.businessIds || []).map((id) => directory.legacyMap.get(id) || id);
    const businessId = directory.legacyMap.get(data.businessId) || data.businessId || mapped[0] || null;
    const businessIds = [...new Set([businessId, ...mapped].filter(Boolean))];
    return { ref: snapshot.ref, businessId, businessIds };
  }).filter((item, index) => {
    const old = memberships.docs[index].data();
    return item.businessId !== old.businessId || JSON.stringify(item.businessIds) !== JSON.stringify(old.businessIds || []);
  });
  await commitInChunks(db, membershipUpdates, (batch, item) => batch.set(item.ref, { businessId: item.businessId, businessIds: item.businessIds, migratedDirectoryVersion: 4, updatedAt: FieldValue.serverTimestamp() }, { merge: true }), 300);

  const claims = await db.collection("businessClaims").get();
  const claimUpdates = claims.docs.map((snapshot) => ({ snapshot, canonicalId: directory.legacyMap.get(snapshot.data().businessId) })).filter((item) => item.canonicalId);
  await commitInChunks(db, claimUpdates, (batch, item) => batch.set(item.snapshot.ref, { legacyBusinessId: item.snapshot.data().businessId, businessId: item.canonicalId, migratedDirectoryVersion: 4, updatedAt: FieldValue.serverTimestamp() }, { merge: true }), 300);

  return { ownership, archivedBusinesses: legacySnapshots.length, migratedMemberships: membershipUpdates.length, migratedClaims: claimUpdates.length };
}

async function counts(db) {
  const names = ["businesses", "branches", "organizations", "roleTemplates", "helpResources", "catalogTemplates"];
  const values = await Promise.all(names.map(async (name) => {
    const snapshot = await db.collection(name).count().get();
    return [name, snapshot.data().count];
  }));
  const currentBrands = await db.collection("businesses").where("directoryVersion", "==", 4).count().get();
  const status = await db.collection("systemStatus").doc("directorySeed").get();
  return { ...Object.fromEntries(values), directoryBrands: currentBrands.data().count, seed: status.exists ? status.data() : null };
}

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ["super_admin", "platform_admin", "operations_manager", "data_import_manager"] });
    const { db } = getAdminServices();
    const directory = preparedDirectory();
    return Response.json({ ok: true, ...(await counts(db)), expectedBusinesses: directory.businesses.length, expectedBranches: directory.branches.length, directoryVersion: 4 });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ["super_admin", "platform_admin", "data_import_manager"] });
    const { db } = getAdminServices();
    const body = await request.json().catch(() => ({}));
    const includeBusinesses = body.includeBusinesses !== false;
    const directory = preparedDirectory();
    const startedAt = new Date().toISOString();
    await db.collection("systemStatus").doc("directorySeed").set({ status: "running", directoryVersion: 4, startedAt, startedBy: actor.uid, expectedBusinesses: includeBusinesses ? directory.businesses.length : 0, expectedBranches: includeBusinesses ? directory.branches.length : 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("platformSettings").doc("global").set({ ...DEFAULT_PLATFORM_SETTINGS, directoryVersion: 4, seededAt: FieldValue.serverTimestamp(), seededBy: actor.uid }, { merge: true });

    await commitInChunks(db, defaultRoleTemplates, (batch, role) => batch.set(db.collection("roleTemplates").doc(role.id), { ...role, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true }));
    await commitInChunks(db, defaultHelpResources, (batch, resource) => batch.set(db.collection("helpResources").doc(resource.id), { ...resource, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true }));
    await commitInChunks(db, groceryCatalogTemplates, (batch, template) => batch.set(db.collection("catalogTemplates").doc(template.id), { ...template, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true }));

    let migration = { ownership: new Map(), archivedBusinesses: 0, migratedMemberships: 0, migratedClaims: 0 };
    if (includeBusinesses) migration = await migrateLegacyDirectory(db, directory);

    if (includeBusinesses) {
      const [existingBusinesses, existingBranches, existingOrganizations] = await Promise.all([
        existingDocumentIds(db, "businesses", directory.businesses.map((record) => record.id)),
        existingDocumentIds(db, "branches", directory.branches.map((record) => record.id)),
        existingDocumentIds(db, "organizations", directory.organizations.map((record) => record.id))
      ]);

      await commitInChunks(db, directory.organizations, (batch, organization) => {
        const reference = db.collection("organizations").doc(organization.id);
        const payload = existingOrganizations.has(organization.id)
          ? { businessIds: organization.businessIds, branchIds: organization.branchIds, directoryRecord: true, directoryVersion: 4, seeded: true, seedSource: organization.source || null, lastSeededAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
          : { ...organization, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastSeededAt: FieldValue.serverTimestamp() };
        batch.set(reference, payload, { merge: true });
      });

      await commitInChunks(db, directory.businesses, (batch, business) => {
        const reference = db.collection("businesses").doc(business.id);
        const inherited = migration.ownership.get(business.id);
        const payload = existingBusinesses.has(business.id)
          ? { organizationId: business.organizationId, branchIds: business.branchIds, branchCount: business.branchCount, cities: business.cities, businessType: business.businessType, capabilities: business.capabilities, operatingModel: business.operatingModel, searchTerms: business.searchTerms, directoryRecord: true, directoryVersion: 4, seeded: true, lastSeededAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
          : { ...business, ownerIds: inherited ? [...inherited.ownerIds] : [], claimStatus: inherited?.claimed ? "claimed" : business.claimStatus, verificationStatus: inherited?.verified ? "approved" : business.verificationStatus, status: inherited?.claimed ? "active" : business.status, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastSeededAt: FieldValue.serverTimestamp() };
        batch.set(reference, payload, { merge: true });
      });

      await commitInChunks(db, directory.branches, (batch, branch) => {
        const reference = db.collection("branches").doc(branch.id);
        const payload = existingBranches.has(branch.id)
          ? { organizationId: branch.organizationId, businessId: branch.businessId, displayName: branch.displayName, branchName: branch.branchName, searchTerms: branch.searchTerms, directoryRecord: true, directoryVersion: 4, seeded: true, lastSeededAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
          : { ...branch, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastSeededAt: FieldValue.serverTimestamp() };
        batch.set(reference, payload, { merge: true });
      }, 240);
    }

    const result = {
      directoryVersion: 4,
      businesses: includeBusinesses ? directory.businesses.length : 0,
      branches: includeBusinesses ? directory.branches.length : 0,
      organizations: includeBusinesses ? directory.organizations.length : 0,
      archivedLegacyBusinesses: migration.archivedBusinesses,
      migratedMemberships: migration.migratedMemberships,
      migratedClaims: migration.migratedClaims,
      roles: defaultRoleTemplates.length,
      helpResources: defaultHelpResources.length,
      catalogTemplates: groceryCatalogTemplates.length
    };
    await db.collection("systemStatus").doc("directorySeed").set({ status: "complete", ...result, completedAt: FieldValue.serverTimestamp(), completedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection("auditLogs").add({ action: "platform.directory_v4_seeded", entityType: "platform", entityId: "global", actorId: actor.uid, actorEmail: actor.email || "", metadata: result, createdAt: FieldValue.serverTimestamp() });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    try {
      const { db } = getAdminServices();
      await db.collection("systemStatus").doc("directorySeed").set({ status: "failed", directoryVersion: 4, error: error.message || "Seed failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch {}
    return apiError(error);
  }
}
