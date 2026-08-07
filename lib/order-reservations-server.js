import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "@/lib/firebase-admin";
import { releaseBookedSlot, releaseReservedQuantity } from "@/lib/reservation-math";

const RELEASABLE_ORDER_STATES = new Set([
  "awaiting_payment",
  "submitted",
  "confirmed",
  "accepted",
  "cancelled",
  "rejected",
  "void",
  "expired",
  "payment_failed",
  "refunded"
]);

export async function releaseOrderReservation(orderId, { reason = "order_cancelled", actorId = "system", status } = {}) {
  const { db } = getAdminServices();
  const orderRef = db.collection("orders").doc(orderId);

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = orderSnapshot.data();
    if (order.inventoryReservationStatus === "released") {
      return { released: false, idempotent: true, orderId };
    }
    if (!RELEASABLE_ORDER_STATES.has(String(order.status || "")) && !status) {
      throw Object.assign(new Error("This order is no longer eligible for reservation release."), { status: 409 });
    }

    const branchRef = order.branchId ? db.collection("branches").doc(order.branchId) : null;
    const productRefs = (order.items || []).filter((item) => item.productId).map((item) => ({ item, ref: db.collection("products").doc(item.productId) }));
    const [branchSnapshot, productSnapshots] = await Promise.all([
      branchRef ? transaction.get(branchRef) : Promise.resolve(null),
      Promise.all(productRefs.map(({ ref }) => transaction.get(ref)))
    ]);

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

    const nextStatus = status || order.status;
    transaction.set(orderRef, {
      status: nextStatus,
      inventoryReservationStatus: "released",
      reservationReleaseReason: reason,
      reservationReleasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.create(db.collection("orderEvents").doc(), {
      orderId,
      type: "inventory_reservation_released",
      status: nextStatus,
      actorId,
      metadata: { reason, slotId: order.pickup?.reservedSlotId || null },
      createdAt: FieldValue.serverTimestamp()
    });
    return { released: true, idempotent: false, orderId };
  });
}
