import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { independentPublicStore, independentQuote, independentShoppingFlags } from "@/lib/independent-shopping";
import { regionalServicePolicy } from "@/lib/v9-assist-regions";

export const runtime = "nodejs";
const selectionSchema = z.object({ itemId: z.string().min(2).max(80), quantity: z.number().int().min(1).max(10) }).strict();
const schema = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{12,70}$/),
  storeId: z.string().min(3).max(100),
  items: z.array(selectionSchema).min(1).max(25),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(7).max(40),
  deliveryAddress: z.string().trim().min(10).max(400),
  notes: z.string().trim().max(500).default("")
}).strict();

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const snapshot = await db.collection("independentShoppingRequests").where("customerId", "==", user.uid).limit(30).get();
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id, storeName: doc.data().storeName, state: doc.data().state,
      estimate: doc.data().estimate,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null
    })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return Response.json({ ok: true, requests }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const input = schema.parse(await request.json());
    const rate = await enforceRateLimit(request, { key: "independent-shopping-request", limit: 12, windowMs: 60 * 60_000, identity: user.uid });
    const { db } = getAdminServices();
    const ref = db.collection("independentShoppingRequests").doc(`${user.uid}_${input.requestId}`);
    const original = await ref.get();
    if (original.exists) {
      if (original.data().customerId !== user.uid) throw Object.assign(new Error("Request conflict."), { status: 409 });
      return Response.json({ ok: true, id: ref.id, state: original.data().state, estimate: original.data().estimate, idempotent: true });
    }
    const [settingsSnap, storeSnap] = await Promise.all([
      db.collection("platformSettings").doc("global").get(),
      db.collection("independentShoppingStores").doc(input.storeId).get()
    ]);
    const settings = settingsSnap.data() || {};
    if (!independentShoppingFlags(settings).requestEnabled) throw Object.assign(new Error("Independent shopping requests are not open yet."), { status: 503 });
    const store = storeSnap.exists ? independentPublicStore(storeSnap.id, storeSnap.data()) : null;
    if (!store) throw Object.assign(new Error("This independent shopping location is not accepting requests."), { status: 409 });
    if (!regionalServicePolicy(settings.assistCoverage || {}, store, "eat").available) throw Object.assign(new Error("Spotly Assist is unavailable in this area."), { status: 409 });
    const estimate = independentQuote(store, input.items, {
      shoppingFee: settings.independentShopping?.shoppingFeeEstimate ?? 0,
      deliveryFee: settings.independentShopping?.deliveryFeeEstimate ?? 0
    });
    const requestRecord = {
      customerId: user.uid, customerEmail: user.email || "",
      storeId: store.id, storeName: store.name, model: "independent_shopping",
      affiliation: "unaffiliated", state: "pending_manual_quote",
      sourceBusinessId: storeSnap.data()?.directoryBusinessId || null,
      items: estimate.items, estimate,
      contactName: input.contactName, contactPhone: input.contactPhone,
      deliveryAddress: input.deliveryAddress, notes: input.notes,
      requiresPriceReconfirmation: true,
      orderCreated: false, paymentStatus: "not_initiated", dispatchStatus: "not_dispatched",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
    try {
      await ref.create(requestRecord);
    } catch (error) {
      if (Number(error?.code) !== 6 && String(error?.code) !== "already-exists") throw error;
      const existing = await ref.get();
      return Response.json({ ok: true, id: ref.id, state: existing.data()?.state || "pending_manual_quote", estimate: existing.data()?.estimate || estimate, idempotent: true });
    }
    return Response.json({
      ok: true, id: ref.id, state: "pending_manual_quote", estimate, paymentCollected: false,
      message: "Request received for price confirmation. Nothing has been purchased or dispatched."
    }, { headers: { "Cache-Control": "private, no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review your contact details, delivery address and item quantities." }, { status: 422 });
    return apiError(error);
  }
}
