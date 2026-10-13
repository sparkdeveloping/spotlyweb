import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const schema = z.object({
  businessId: z.string().min(1).max(180),
  reason: z.string().min(8).max(500)
});

function serialize(value) {
  if (value == null) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function docs(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) }));
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, {
      roles: ["super_admin", "admin", "platform_admin", "operations_manager", "support_manager", "support_agent", "business_success_manager"]
    });
    const input = schema.parse(await request.json());
    const { db } = getAdminServices();
    const [settingsSnapshot, businessSnapshot] = await Promise.all([
      db.collection("platformSettings").doc("global").get(),
      db.collection("businesses").doc(input.businessId).get()
    ]);
    if (!businessSnapshot.exists) throw Object.assign(new Error("The business was not found."), { status: 404 });
    if (settingsSnapshot.data()?.security?.supportViewEnabled === false) {
      throw Object.assign(new Error("Administrator support view is disabled in platform settings."), { status: 403 });
    }

    const [branches, products, orders, claims, finance] = await Promise.all([
      db.collection("branches").where("businessId", "==", input.businessId).limit(100).get(),
      db.collection("products").where("businessId", "==", input.businessId).limit(150).get(),
      db.collection("orders").where("businessId", "==", input.businessId).limit(75).get(),
      db.collection("businessClaims").where("businessId", "==", input.businessId).limit(20).get(),
      db.collection("businessFinanceSettings").doc(input.businessId).get()
    ]);

    const sessionRef = db.collection("supportViewSessions").doc();
    const now = Date.now();
    await db.runTransaction(async (transaction) => {
      transaction.create(sessionRef, {
        businessId: input.businessId,
        actorId: actor.uid,
        actorEmail: actor.email || "",
        reason: input.reason,
        status: "opened",
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 30 * 60 * 1000)
      });
      transaction.create(db.collection("auditLogs").doc(), {
        action: "admin.support_view.opened",
        entityType: "business",
        entityId: input.businessId,
        actorId: actor.uid,
        actorEmail: actor.email || "",
        metadata: { reason: input.reason, sessionId: sessionRef.id },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    const financeData = finance.exists ? serialize(finance.data()) : null;
    if (financeData) {
      delete financeData.accountNumber;
      delete financeData.mobileMoneyNumber;
      delete financeData.taxNumber;
    }

    return Response.json({
      ok: true,
      session: { id: sessionRef.id, expiresAt: new Date(now + 30 * 60 * 1000).toISOString(), reason: input.reason },
      business: { id: businessSnapshot.id, ...serialize(businessSnapshot.data()) },
      branches: docs(branches),
      products: docs(products),
      orders: docs(orders),
      claims: docs(claims),
      finance: financeData
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Enter a clear reason before opening support view." }, { status: 400 });
    return apiError(error);
  }
}
