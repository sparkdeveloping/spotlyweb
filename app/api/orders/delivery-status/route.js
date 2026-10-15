import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { docData } from "@/lib/driver-delivery-server";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const orderId = new URL(request.url).searchParams.get("orderId") || "";
    if (!orderId) throw Object.assign(new Error("Choose an order."), { status: 400 });
    const { db } = getAdminServices();
    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists) throw Object.assign(new Error("Order not found."), { status: 404 });
    const order = docData(orderSnap);
    if (order.customerId !== user.uid) throw Object.assign(new Error("You do not have access to this delivery."), { status: 403 });
    if (order.fulfilment !== "delivery" || !order.deliveryJobId) return Response.json({ ok: true, fulfilment: order.fulfilment || "pickup" });
    const jobSnap = await db.collection("deliveryJobs").doc(order.deliveryJobId).get();
    if (!jobSnap.exists) throw Object.assign(new Error("Delivery record not found."), { status: 404 });
    const job = jobSnap.data();
    const pinVisible = ["en_route", "driver_arrived_customer", "handoff_verification"].includes(job.state);
    const shoppingItems = Array.isArray(job.shopping?.items) ? job.shopping.items : [];
    const pendingSubstitutions = shoppingItems.filter((item) => item.status === "substitution_pending").map((item) => ({
      productId: item.productId,
      name: item.name || "Item",
      requestedQuantity: Number(item.requestedQuantity || 1),
      estimatedUnitPrice: Number(item.estimatedUnitPrice || 0),
      replacementName: item.proposedReplacementName || "Replacement",
      proposedQuantity: Number(item.proposedQuantity || 1),
      proposedUnitPrice: Number(item.proposedUnitPrice || 0),
      requestedAt: item.substitutionRequestedAt || null
    }));
    return Response.json({
      ok: true,
      fulfilment: "delivery",
      delivery: {
        id: jobSnap.id,
        number: job.number,
        state: job.state,
        driverAssigned: Boolean(job.assignedDriverId),
        customerPin: pinVisible ? String(job.customerPin || "") : "",
        shopping: job.fulfilmentMode === "driver_shops" ? {
          state: job.shopping?.state || job.state,
          substitutionPreference: job.shopping?.substitutionPreference || order.shopping?.substitutionPreference || "contact_me",
          pendingSubstitutions
        } : null,
        updatedAt: job.updatedAt?.toDate?.()?.toISOString?.() || job.updatedAt || null
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
