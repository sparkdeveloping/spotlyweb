import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebase-admin";
import { releaseBookedSlot, releaseReservedQuantity } from "@/lib/reservation-math";

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
  const branchSnapshot = branchRef ? await transaction.get(branchRef) : null;
  const productSnapshots = [];
  for (const entry of productRefs) productSnapshots.push(await transaction.get(entry.ref));

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
    metadata: { reason, slotId: order.pickup?.reservedSlotId || null },
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
