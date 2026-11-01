import { requireCustomerLaunchAccess } from "@/lib/customer-launch-server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { independentPublicStore, independentQuote, independentShoppingFlags } from "@/lib/independent-shopping";
import { regionalServicePolicy } from "@/lib/v9-assist-regions";
import { notifyRoleAudience } from "@/lib/notification-server";
import { filterSafeIndependentStores } from "@/lib/assist-store-safety";
import { canonicalIndependentSource, directoryShoppingStore } from "@/lib/directory-shopping-server";
import { independentStoreRequestSafe } from "@/lib/assist-store-safety";
import { catalogueService, refreshDirectoryCatalogue } from "@/lib/spotly-catalogue";
import { independentPaymentEnabled } from "@/lib/assist-money";

export const runtime = "nodejs";
const selectionSchema = z.object({ itemId: z.string().min(2).max(80), quantity: z.number().int().min(1).max(10), choices: z.array(z.object({ group: z.string().min(1).max(60), value: z.string().min(1).max(120) }).strict()).max(6).optional() }).strict();
const schema = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{12,70}$/),
  storeId: z.string().regex(/^[A-Za-z0-9_-]{3,360}$/),
  items: z.array(selectionSchema).max(25),
  customItems: z.array(z.object({ name: z.string().trim().min(2).max(160), quantity: z.number().int().min(1).max(10) }).strict()).max(15).default([]),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(7).max(40),
  deliveryAddress: z.string().trim().min(10).max(400),
  notes: z.string().trim().max(500).default("")
}).strict();

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request,{key:"assist-customer-history",limit:90,windowMs:60000,identity:user.uid});
    const { db } = getAdminServices();
    const [snapshot,settingsSnap] = await Promise.all([
      db.collection("independentShoppingRequests").where("customerId", "==", user.uid).limit(30).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    const ids=[...new Set(snapshot.docs.map(doc=>doc.data().storeId).filter(Boolean))];
    const storeDocs=ids.length?await db.getAll(...ids.map(id=>db.collection("independentShoppingStores").doc(id))):[];
    const paymentReady=new Map(storeDocs.filter(doc=>doc.exists).map(doc=>[doc.id,independentPaymentEnabled(settingsSnap.data()||{},doc.data())]));
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id, items: doc.data().items || [], assistService: doc.data().assistService || "eat", collectionAddress: doc.data().collectionAddress || "", storeName: doc.data().storeName, state: doc.data().state,
      estimate: doc.data().estimate, finalQuote: doc.data().finalQuote || null, customerMessage: doc.data().customerMessage || "",
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
      storeId:doc.data().storeId,deliveryPin:doc.data().state==="delivered"?null:(doc.data().customerDeliveryPin||null),
      paymentStatus:doc.data().paymentStatus||"not_initiated",
      paymentAvailable:doc.data().state==="quote_accepted_awaiting_payment"&&
        (doc.data().paymentStatus||"not_initiated")==="not_initiated"&&
        !doc.data().paymentIntentReference&&
        Date.parse(doc.data().finalQuote?.expiresAt)>Date.now()&&
        paymentReady.get(doc.data().storeId)===true,
      pendingSubstitutions:doc.data().pendingSubstitutions||[],refundDue:doc.data().refundDue??null,
      refundStatus:doc.data().refundStatus||null,refundPending:doc.data().refundPending||0,
      refundReconciled:doc.data().refundReconciled||0,cancellationRequested:doc.data().cancellationRequested===true,
      dispatchStatus:doc.data().dispatchStatus||"not_dispatched"
    })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return Response.json({ ok: true, requests }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    await requireCustomerLaunchAccess(user, getAdminServices().db);
    const input = schema.parse(await request.json());
    const rate = await enforceRateLimit(request, { key: "independent-shopping-request", limit: 12, windowMs: 60 * 60_000, identity: user.uid });
    const { db, messaging, auth } = getAdminServices();
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
    let rawStore;
    let store;
    if (input.storeId.startsWith("directory_")) {
      const found = await directoryShoppingStore(db, { storeId: input.storeId, settings });
      rawStore = found?.raw;
      store = found?.store;
    } else {
      const safe = storeSnap.exists ? await filterSafeIndependentStores(db, [{ ...storeSnap.data(), id: storeSnap.id }]) : [];
      rawStore = safe[0];
      store = rawStore ? independentPublicStore(input.storeId, rawStore) : null;
    }
    if (!store || !rawStore) throw Object.assign(new Error("This shopping location is not accepting requests."), { status: 409 });
    let estimate;
    try { estimate = independentQuote(store, input.items, {
      customItems: input.customItems,
      shoppingFee: settings.independentShopping?.shoppingFeeEstimate ?? 0,
      deliveryFee: settings.independentShopping?.deliveryFeeEstimate ?? 0
    }); } catch (error) { throw Object.assign(error, {status:422}); }
    const requestRecord = {
      customerId: user.uid, customerEmail: user.email || "",
      storeId: store.id, storeName: store.name, model: "independent_shopping",
      affiliation: "unaffiliated", state: "pending_manual_quote",
      sourceBusinessId: rawStore.directoryBusinessId || null, directoryBranchId: rawStore.directoryBranchId || null,
      assistService: catalogueService(rawStore), collectionAddress: rawStore.address || "",
      items: estimate.items, estimate,
      contactName: input.contactName, contactPhone: input.contactPhone,
      deliveryAddress: input.deliveryAddress, notes: input.notes,
      requiresPriceReconfirmation: true,
      orderCreated: false, paymentStatus: "not_initiated", dispatchStatus: "not_dispatched",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
    const saved = await db.runTransaction(async tx => {
      const storeRef = db.collection("independentShoppingStores").doc(store.id);
      const [prior, currentStore, currentSettings] = await Promise.all([tx.get(ref), tx.get(storeRef), tx.get(db.collection("platformSettings").doc("global"))]);
      if (prior.exists) return { idempotent: true, record: prior.data() };
      const active = currentStore.exists ? { ...currentStore.data(), id: currentStore.id } : rawStore;
      const canonical = active.directoryBusinessId ? await tx.get(db.collection("businesses").doc(active.directoryBusinessId)) : null;
      const branch = active.directoryBranchId ? await tx.get(db.collection("branches").doc(active.directoryBranchId)) : null;
      if (!independentStoreRequestSafe(active, active.directoryBusinessId ? canonicalIndependentSource(canonical, active.directoryBusinessId) : null, branch?.exists ? branch.data() : null) ||
          !independentShoppingFlags(currentSettings.data()).requestEnabled ||
          !regionalServicePolicy(currentSettings.data()?.assistCoverage || {}, active, catalogueService(active)).available) {
        throw Object.assign(new Error("This location has changed availability. Refresh before submitting."), { status: 409 });
      }
      if (!currentStore.exists) tx.create(storeRef, { ...rawStore, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      else if (rawStore.catalogueOrigin === "spotly_reference" && refreshDirectoryCatalogue(active,rawStore) !== active && active.catalogueVersion !== rawStore.catalogueVersion) tx.set(storeRef, {items:rawStore.items,catalogueOrigin:rawStore.catalogueOrigin,catalogueVersion:rawStore.catalogueVersion,catalogueScope:rawStore.catalogueScope,updatedAt:FieldValue.serverTimestamp()}, {merge:true});
      tx.create(ref, requestRecord);
      return { idempotent: false, record: requestRecord };
    });
    if (saved.idempotent) return Response.json({ ok: true, id: ref.id, state: saved.record.state, estimate: saved.record.estimate, idempotent: true });
    await notifyRoleAudience({db,messaging,auth,
      title:"Independent shopping request",
      body:store.name+" · "+input.contactName+" · "+input.deliveryAddress,
      workspace:"admin",href:"/assist",category:"assist_shopping",
      module:"spotly_assist",eventType:"assist.shopping.requested"
    },["operations_manager","support_manager"]).catch(()=>{});
    return Response.json({
      ok: true, id: ref.id, state: "pending_manual_quote", estimate, paymentCollected: false,
      message: "Request received for price confirmation. Nothing has been purchased or dispatched."
    }, { headers: { "Cache-Control": "private, no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review your contact details, delivery address and item quantities." }, { status: 422 });
    return apiError(error);
  }
}
