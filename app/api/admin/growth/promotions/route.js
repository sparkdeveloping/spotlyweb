import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { normalizePromotionCode } from "@/lib/customer-growth";

export const runtime = "nodejs";

const promotionSchema = z.object({
  id: z.string().trim().max(160).optional().default(""),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional().default(""),
  code: z.string().trim().max(40).optional().default(""),
  type: z.enum(["percentage", "fixed"]).default("percentage"),
  value: z.coerce.number().positive().max(100000),
  currency: z.enum(["USD", "ZWG"]).default("USD"),
  minimumSpend: z.coerce.number().min(0).max(1000000).default(0),
  usageLimit: z.coerce.number().int().min(0).max(1000000).default(0),
  audience: z.enum(["all_customers", "new_customers", "returning_customers", "private_beta"]).default("all_customers"),
  startsAt: z.string().trim().max(20).default(""),
  endsAt: z.string().trim().max(20).default(""),
  businessIds: z.array(z.string().trim().min(1).max(160)).max(250).default([]),
  active: z.boolean().default(true)
});

async function actorFor(request) {
  return authenticateRequest(request, { roles: ["super_admin", "platform_admin", "marketing_manager"] });
}

function publicAdminRecord(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name || "Spotly offer",
    description: data.description || "",
    code: normalizePromotionCode(data.code),
    type: data.type === "fixed" ? "fixed" : "percentage",
    value: Number(data.value || 0),
    currency: data.currency || "USD",
    minimumSpend: Number(data.minimumSpend || 0),
    usageLimit: Number(data.usageLimit || 0),
    usedCount: Number(data.usedCount || 0),
    audience: data.audience || "all_customers",
    startsAt: data.startsAt || "",
    endsAt: data.endsAt || "",
    businessIds: Array.isArray(data.businessIds) ? data.businessIds : [],
    active: data.active !== false,
    status: data.status || (data.active === false ? "paused" : "active")
  };
}

export async function GET(request) {
  try {
    await actorFor(request);
    const { db } = getAdminServices();
    const snapshot = await db.collection("promotions").where("scope", "==", "platform").limit(250).get();
    const promotions = snapshot.docs.map(publicAdminRecord).sort((a, b) => String(b.startsAt || "").localeCompare(String(a.startsAt || "")) || a.name.localeCompare(b.name));
    return Response.json({ ok: true, promotions });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await actorFor(request);
    const input = promotionSchema.parse(await request.json());
    if (input.type === "percentage" && input.value > 100) return Response.json({ ok: false, error: "Percentage discounts cannot exceed 100%." }, { status: 422 });
    if (input.endsAt && input.startsAt && input.endsAt < input.startsAt) return Response.json({ ok: false, error: "The campaign end date must be after the start date." }, { status: 422 });
    const { db } = getAdminServices();
    const ref = input.id ? db.collection("promotions").doc(input.id) : db.collection("promotions").doc();
    if (input.id) {
      const current = await ref.get();
      if (!current.exists || current.data()?.scope !== "platform") return Response.json({ ok: false, error: "That Spotly campaign was not found." }, { status: 404 });
    }
    const now = FieldValue.serverTimestamp();
    const businessIds = [...new Set(input.businessIds.filter(Boolean))];
    const payload = {
      scope: "platform",
      businessId: "",
      businessIds,
      branchIds: [],
      productIds: [],
      name: input.name,
      description: input.description,
      code: normalizePromotionCode(input.code),
      type: input.type,
      value: input.value,
      currency: input.currency,
      minimumSpend: input.minimumSpend,
      usageLimit: input.usageLimit,
      audience: input.audience,
      startsAt: input.startsAt || new Date().toISOString().slice(0, 10),
      endsAt: input.endsAt,
      active: input.active,
      status: input.active ? "active" : "paused",
      updatedAt: now,
      updatedBy: actor.uid
    };
    if (!input.id) Object.assign(payload, { usedCount: 0, createdAt: now, createdBy: actor.uid });
    await ref.set(payload, { merge: true });
    await db.collection("auditLogs").add({
      action: input.id ? "growth.platform_promotion_updated" : "growth.platform_promotion_created",
      entityType: "promotion",
      entityId: ref.id,
      actorId: actor.uid,
      actorEmail: actor.email || "",
      metadata: { name: input.name, active: input.active, businessScopeCount: businessIds.length },
      createdAt: now
    });
    return Response.json({ ok: true, promotionId: ref.id });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the campaign details and try again.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}

export async function DELETE(request) {
  try {
    const actor = await actorFor(request);
    const body = z.object({ id: z.string().trim().min(1).max(160) }).parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("promotions").doc(body.id);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.scope !== "platform") return Response.json({ ok: false, error: "That Spotly campaign was not found." }, { status: 404 });
    await db.runTransaction(async (transaction) => {
      transaction.delete(ref);
      transaction.create(db.collection("auditLogs").doc(), {
        action: "growth.platform_promotion_deleted",
        entityType: "promotion",
        entityId: ref.id,
        actorId: actor.uid,
        actorEmail: actor.email || "",
        metadata: { name: snapshot.data()?.name || "" },
        createdAt: FieldValue.serverTimestamp()
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a valid campaign." }, { status: 400 });
    return apiError(error);
  }
}
