import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { assistCountryDefaults } from "@/lib/spotly-assist";

export const runtime = "nodejs";
const code = z.string().trim().regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase());
const schema = z.object({
  scope: z.enum(["global","country","city","area","business"]),
  country: code.optional(),
  city: z.string().trim().max(120).optional(),
  area: z.string().trim().max(120).optional(),
  businessId: z.string().trim().max(180).optional(),
  enabled: z.boolean()
}).strict();
const slug = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "operations.read", { roles: ["operations_manager", "regional_operations_manager"] });
    const { db } = getAdminServices();
    const snap = await db.collection("platformSettings").doc("global").get();
    const coverage = snap.data()?.assistCoverage || {};
    return Response.json({ ok: true, coverage, countries: [assistCountryDefaults("ZW"), assistCountryDefaults("MW")],
      message: "Spotly Assist request intake is enabled by default where a location qualifies. Disable any country, city, area or individual location here. Confirmed orders still require payment and fulfilment readiness."
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "admin.configuration", { roles: ["super_admin", "platform_admin", "operations_manager"] });
    const body = schema.parse(await request.json());
    if (body.scope !== "global" && body.scope !== "business" && !body.country) throw Object.assign(new Error("Choose a country."), { status: 422 });
    if (["city","area"].includes(body.scope) && !body.city) throw Object.assign(new Error("Choose a city."), { status: 422 });
    if (body.scope === "area" && !body.area) throw Object.assign(new Error("Choose an area."), { status: 422 });
    if (body.scope === "business" && !body.businessId) throw Object.assign(new Error("Choose a location."), { status: 422 });
    const { db } = getAdminServices();
    const settingsRef = db.collection("platformSettings").doc("global");
    if (body.scope === "business") {
      const businessRef = db.collection("businesses").doc(body.businessId);
      const businessSnap = await businessRef.get();
      if (!businessSnap.exists) throw Object.assign(new Error("Business not found."), { status: 404 });
      await businessRef.set({ assistEnabled: body.enabled, assistEnabledUpdatedAt: FieldValue.serverTimestamp(), assistEnabledUpdatedBy: actor.uid }, { merge: true });
    } else {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(settingsRef);
        const coverage = { ...(existing.data()?.assistCoverage || {}) };
        if (body.scope === "global") coverage.globalEnabled = body.enabled;
        else {
          const collection = body.scope === "country" ? "countries" : body.scope === "city" ? "cities" : "areas";
          const key = body.scope === "country" ? body.country : body.scope === "city"
            ? `${body.country}:${slug(body.city)}` : `${body.country}:${slug(body.city)}:${slug(body.area)}`;
          coverage[collection] = { ...(coverage[collection] || {}), [key]: { enabled: body.enabled, updatedBy: actor.uid } };
        }
        tx.set(settingsRef, { assistCoverage: coverage, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
      });
    }
    await db.collection("auditLogs").add({ action: "assist.coverage.updated", entityType: body.scope,
      entityId: body.businessId || [body.country || "Africa", body.city, body.area].filter(Boolean).join("/"),
      actorId: actor.uid, metadata: body, createdAt: FieldValue.serverTimestamp()
    });
    return Response.json({ ok: true, scope: body.scope, enabled: body.enabled });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the selected location and availability." }, { status: 422 });
    return apiError(error);
  }
}
