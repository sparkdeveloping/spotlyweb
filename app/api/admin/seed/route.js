import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/platform-defaults";
import { zimbabweBusinesses } from "@/data/zimbabwe-businesses";
import { defaultRoleTemplates, defaultHelpResources } from "@/data/production-seed";
import { groceryCatalogTemplates } from "@/data/catalog-templates";

export const runtime = "nodejs";

async function commitInChunks(db, records, writer) {
  const chunkSize = 400;
  for (let start = 0; start < records.length; start += chunkSize) {
    const batch = db.batch();
    records.slice(start, start + chunkSize).forEach((record) => writer(batch, record));
    await batch.commit();
  }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ["super_admin"] });
    const { db } = getAdminServices();
    const body = await request.json().catch(() => ({}));
    const includeBusinesses = body.includeBusinesses !== false;

    await db.collection("platformSettings").doc("global").set({ ...DEFAULT_PLATFORM_SETTINGS, seededAt: FieldValue.serverTimestamp(), seededBy: actor.uid }, { merge: true });

    await commitInChunks(db, defaultRoleTemplates, (batch, role) => {
      batch.set(db.collection("roleTemplates").doc(role.id), { ...role, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true });
    });
    await commitInChunks(db, defaultHelpResources, (batch, resource) => {
      batch.set(db.collection("helpResources").doc(resource.id), { ...resource, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true });
    });
    await commitInChunks(db, groceryCatalogTemplates, (batch, template) => {
      batch.set(db.collection("catalogTemplates").doc(template.id), { ...template, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true });
    });

    if (includeBusinesses) {
      await commitInChunks(db, zimbabweBusinesses, (batch, business) => {
        batch.set(db.collection("businesses").doc(business.id), { ...business, updatedAt: FieldValue.serverTimestamp(), seeded: true }, { merge: true });
      });
    }

    await db.collection("auditLogs").add({
      action: "platform.seeded",
      entityType: "platform",
      entityId: "global",
      actorId: actor.uid,
      actorEmail: actor.email || "",
      metadata: { businesses: includeBusinesses ? zimbabweBusinesses.length : 0, roles: defaultRoleTemplates.length, helpResources: defaultHelpResources.length, catalogTemplates: groceryCatalogTemplates.length },
      createdAt: FieldValue.serverTimestamp()
    });

    return Response.json({ ok: true, businesses: includeBusinesses ? zimbabweBusinesses.length : 0, roles: defaultRoleTemplates.length, helpResources: defaultHelpResources.length, catalogTemplates: groceryCatalogTemplates.length });
  } catch (error) {
    return apiError(error);
  }
}
