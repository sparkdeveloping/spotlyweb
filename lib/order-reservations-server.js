import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebase-admin";
import { releaseBookedSlot, releaseReservedQuantity } from "@/lib/reservation-math";
import { reservationReleaseCount } from "@/lib/availability-reservations";

const FULFILLED_STATES = new Set(["picked_up", "completed", "checked_in", "checked_out", "delivered"]);

export async function releaseReservationInTransaction(transaction, db, orderRef, order, {
  reason,
  actorId = "system",
  nextStatus = null,
  source = "server",
  orderPatch = {}
} = {}) {
  if (order.inventoryReservationStatus === "released") {
    return { released: false, idempotent: true, orderId: orderRef.id };
  }
  if (FULFILLED_STATES.has(String(order.status || ""))) {
    throw Object.assign(new Error("Fulfilled orders cannot release inventory reservations."), { status: 409 });
  }
  if (["paid", "refund_pending", "refunded"].includes(order.paymentStatus) && reason !== "refund_before_fulfilment") {
    throw Object.assign(new Error("Paid orders require the refund workflow before inventory can be released."), { status: 409 });
  }

  const branchRef = order.branchId ? db.collection("branches").doc(order.branchId) : null;
  const productRefs = (order.items || []).filter((item) => item.productId).map((item) => ({ item, ref: db.collection("products").doc(item.productId) }));
  const availabilityEntries = (order.availabilityReservations || []).filter((item) => item?.id).map((item) => ({ item, ref: db.collection("availabilityReservations").doc(item.id) }));
  const promotionRef = order.promotion?.id ? db.collection("promotions").doc(order.promotion.id) : null;
  const promotionRedemptionRef = order.promotion?.id ? db.collection("promotionRedemptions").doc(`${order.promotion.id}_${orderRef.id}`) : null;
  const branchSnapshot = branchRef ? await transaction.get(branchRef) : null;
  const productSnapshots = [];
  for (const entry of productRefs) productSnapshots.push(await transaction.get(entry.ref));
  const availabilitySnapshots = [];
  for (const entry of availabilityEntries) availabilitySnapshots.push(await transaction.get(entry.ref));
  const promotionSnapshot = promotionRef ? await transaction.get(promotionRef) : null;
  const promotionRedemptionSnapshot = promotionRedemptionRef ? await transaction.get(promotionRedemptionRef) : null;

  if (branchRef && branchSnapshot?.exists && order.pickup?.reservedSlotId) {
    const branch = branchSnapshot.data();
    const bookedSlots = releaseBookedSlot(branch.pickup?.bookedSlots, order.pickup.reservedSlotId);
    transaction.set(branchRef, { pickup: { ...(branch.pickup || {}), bookedSlots }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  productRefs.forEach(({ item, ref }, index) => {
    const snapshot = productSnapshots[index];
    if (!snapshot.exists) return;
    const product = snapshot.data();
    const current = Math.max(0, Number(product.reservedQuantity || 0));
    transaction.set(ref, { reservedQuantity: releaseReservedQuantity(current, item.quantity), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  availabilityEntries.forEach(({ item, ref }, index) => {
    const snapshot = availabilitySnapshots[index];
    if (!snapshot?.exists) return;
    const remaining = reservationReleaseCount(snapshot.data()?.reserved, item.units || 1);
    if (remaining <= 0) transaction.delete(ref);
    else transaction.set(ref, { reserved: remaining, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  if (promotionRef && promotionSnapshot?.exists && promotionRedemptionSnapshot?.exists && promotionRedemptionSnapshot.data()?.status !== "released") {
    const currentUses = Math.max(0, Number(promotionSnapshot.data()?.usedCount || 0));
    transaction.set(promotionRef, { usedCount: Math.max(0, currentUses - 1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(promotionRedemptionRef, { status: "released", releaseReason: reason || "reservation_released", releasedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  const status = nextStatus || order.status;
  transaction.set(orderRef, {
    ...orderPatch,
    ...(nextStatus ? { status: nextStatus } : {}),
    inventoryReservationStatus: "released",
    reservationReleaseReason: reason,
    reservationReleasedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  transaction.create(db.collection("orderEvents").doc(), {
    orderId: orderRef.id,
    type: "inventory_reservation_released",
    previousStatus: order.status || null,
    status,
    actorType: actorId === "paynow" || actorId === "system" ? "system" : "user",
    actorId,
    source,
    metadata: { reason, slotId: order.pickup?.reservedSlotId || null, availabilityReservationIds: availabilityEntries.map(({ item }) => item.id) },
    createdAt: FieldValue.serverTimestamp()
  });
  return { released: true, idempotent: false, orderId: orderRef.id };
}

export async function releaseOrderReservation(orderId, options = {}) {
  const { db } = getAdminServices();
  const orderRef = db.collection("orders").doc(orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    return releaseReservationInTransaction(transaction, db, orderRef, snapshot.data(), options);
  });
}
