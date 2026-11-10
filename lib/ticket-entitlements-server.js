import "server-only";

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

export function ticketCode() {
  return `SPT-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function issueTicketEntitlementsInTransaction(transaction, db, orderRef, order, { now = FieldValue.serverTimestamp(), source = "system", codes: providedCodes = null, patchOrder = true } = {}) {
  if (order.transactionType !== "ticket") return [];
  const existingCodes = Array.isArray(order.ticketCodes) ? order.ticketCodes.filter(Boolean) : [];
  const quantity = Math.max(1, Number(order.items?.[0]?.quantity || order.itemCount || 1));
  const supplied = Array.isArray(providedCodes) ? providedCodes.filter(Boolean) : [];
  const codes = supplied.length === quantity ? supplied : existingCodes.length === quantity ? existingCodes : Array.from({ length: quantity }, () => ticketCode());
  const productId = order.items?.[0]?.productId || "";
  for (let index = 0; index < quantity; index += 1) {
    const ref = db.collection("ticketEntitlements").doc(`${orderRef.id}_${String(index + 1).padStart(3, "0")}`);
    transaction.set(ref, {
      orderId: orderRef.id,
      orderNumber: order.number || order.orderNumber || orderRef.id,
      customerId: order.customerId,
      businessId: order.businessId || "",
      branchId: order.branchId || "",
      productId,
      eventId: order.event?.eventId || productId,
      eventName: order.event?.name || order.items?.[0]?.name || "Event",
      ticketTier: order.items?.[0]?.ticketType || order.items?.[0]?.variant || "Standard",
      code: codes[index],
      state: "active",
      transferable: order.event?.transferable !== false,
      startsAt: order.event?.startsAt || null,
      endsAt: order.event?.endsAt || null,
      venue: order.event?.venue || "",
      ownerUserId: order.customerId,
      issuedSource: source,
      issuedAt: now,
      updatedAt: now
    }, { merge: true });
  }
  if (patchOrder) transaction.set(orderRef, { ticketCodes: codes, ticketCode: codes[0] || null, ticketOwnershipStatus: "issued", issuedAt: order.issuedAt || now, updatedAt: now }, { merge: true });
  return codes;
}

export function revokeTicketEntitlementsInTransaction(transaction, db, orderRef, order, { now = FieldValue.serverTimestamp(), reason = "cancelled" } = {}) {
  if (order.transactionType !== "ticket") return;
  const quantity = Math.max(1, Number(order.items?.[0]?.quantity || order.itemCount || 1));
  for (let index = 0; index < quantity; index += 1) {
    const ref = db.collection("ticketEntitlements").doc(`${orderRef.id}_${String(index + 1).padStart(3, "0")}`);
    transaction.set(ref, { state: "revoked", revokedReason: reason, revokedAt: now, updatedAt: now }, { merge: true });
  }
  transaction.set(orderRef, { ticketOwnershipStatus: "revoked", updatedAt: now }, { merge: true });
}
