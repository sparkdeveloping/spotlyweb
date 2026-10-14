import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";

const schema = z.object({ conversationId: z.string().min(3).max(180) });

function serialize(value) {
  if (value == null) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function pick(source = {}, fields = []) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, serialize(source[field])]));
}

function asRecord(snapshot, fields) {
  if (!snapshot?.exists) return null;
  return { id: snapshot.id, ...pick(snapshot.data(), fields) };
}

function docs(snapshot, fields) {
  return snapshot?.docs?.map((item) => ({ id: item.id, ...pick(item.data(), fields) })) || [];
}

function time(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

async function maybeDoc(db, collection, id, fields) {
  if (!id) return null;
  const snapshot = await db.collection(collection).doc(String(id)).get();
  return asRecord(snapshot, fields);
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "support.read", { roles: ["support_agent", "support_manager", "operations_manager", "regional_operations_manager", "business_success_manager"] });
    const input = schema.parse(await request.json());
    const { db } = getAdminServices();
    const conversationSnapshot = await db.collection("supportConversations").doc(input.conversationId).get();
    if (!conversationSnapshot.exists) throw Object.assign(new Error("The support conversation was not found."), { status: 404 });
    const conversation = conversationSnapshot.data();
    const context = conversation.context && typeof conversation.context === "object" ? conversation.context : {};
    const requesterId = conversation.requesterId || null;
    const businessId = conversation.businessId || context.businessId || null;
    const type = String(conversation.contextType || context.contextType || "").toLowerCase();
    const directId = conversation.contextId || context.contextId || null;

    const orderId = context.orderId || context.order || (["order", "orders", "booking", "ticket", "service", "purchase", "payment"].some((value) => type.includes(value)) ? directId : null);
    const rideId = context.rideId || context.rideTripId || (type.includes("ride") ? directId : null);
    const parcelId = context.parcelJobId || context.parcelId || (type.includes("send") || type.includes("parcel") ? directId : null);
    const deliveryId = context.deliveryJobId || context.deliveryId || (type.includes("delivery") ? directId : null);
    const claimId = context.claimId || (type.includes("claim") ? directId : null);

    const [requesterSnapshot, businessSnapshot, order, ride, parcel, delivery, claim, recentOrdersSnapshot, recentRidesSnapshot, recentParcelsSnapshot, historySnapshot, usersSnapshot] = await Promise.all([
      requesterId ? db.collection("users").doc(requesterId).get() : Promise.resolve(null),
      businessId ? db.collection("businesses").doc(businessId).get() : Promise.resolve(null),
      maybeDoc(db, "orders", orderId, ["number", "status", "transactionType", "paymentStatus", "paymentMethod", "total", "subtotal", "currency", "businessId", "branchId", "customerId", "deliveryStatus", "sendStatus", "fulfilment", "createdAt", "updatedAt", "paymentIntentReference", "rideTripId", "parcelJobId", "serviceName", "eventName", "bookingDate", "scheduledFor"]),
      maybeDoc(db, "rideTrips", rideId, ["number", "state", "serviceType", "currency", "total", "customerId", "assignedDriverId", "pickup", "dropoff", "paymentMethod", "paymentStatus", "createdAt", "updatedAt"]),
      maybeDoc(db, "parcelJobs", parcelId, ["number", "state", "currency", "total", "customerId", "orderId", "assignedDriverId", "pickup", "dropoff", "parcelSize", "paymentMethod", "createdAt", "updatedAt", "scheduledPickupAt"]),
      maybeDoc(db, "deliveryJobs", deliveryId, ["number", "status", "customerId", "orderId", "businessId", "branchId", "assignedDriverId", "pickup", "dropoff", "createdAt", "updatedAt"]),
      maybeDoc(db, "businessClaims", claimId, ["status", "businessId", "requesterId", "businessName", "reason", "createdAt", "updatedAt"]),
      requesterId ? db.collection("orders").where("customerId", "==", requesterId).limit(12).get() : Promise.resolve(null),
      requesterId ? db.collection("rideTrips").where("customerId", "==", requesterId).limit(8).get() : Promise.resolve(null),
      requesterId ? db.collection("parcelJobs").where("customerId", "==", requesterId).limit(8).get() : Promise.resolve(null),
      requesterId ? db.collection("supportConversations").where("requesterId", "==", requesterId).limit(20).get() : Promise.resolve(null),
      db.collection("users").limit(500).get()
    ]);

    const paymentIntent = order?.paymentIntentReference
      ? await maybeDoc(db, "paymentIntents", order.paymentIntentReference, ["status", "amount", "currency", "reference", "channel", "createdAt", "updatedAt", "paidAt"])
      : null;

    const requester = requesterSnapshot?.exists ? {
      id: requesterSnapshot.id,
      ...pick(requesterSnapshot.data(), ["displayName", "email", "phone", "phoneNumber", "city", "country", "status", "roles", "createdAt", "lastLoginAt"])
    } : (requesterId ? { id: requesterId, displayName: conversation.requesterName || "", email: conversation.requesterEmail || "" } : null);

    const business = businessSnapshot?.exists ? {
      id: businessSnapshot.id,
      ...pick(businessSnapshot.data(), ["name", "slug", "status", "verificationStatus", "claimStatus", "public", "city", "phone", "email", "organizationId"])
    } : null;

    const orderFields = ["number", "status", "transactionType", "paymentStatus", "paymentMethod", "total", "currency", "businessId", "branchId", "deliveryStatus", "sendStatus", "fulfilment", "createdAt", "updatedAt"];
    const rideFields = ["number", "state", "serviceType", "currency", "total", "paymentStatus", "createdAt", "updatedAt"];
    const parcelFields = ["number", "state", "currency", "total", "paymentMethod", "parcelSize", "createdAt", "updatedAt", "scheduledPickupAt"];
    const recentActivity = [
      ...docs(recentOrdersSnapshot, orderFields).map((item) => ({ ...item, kind: item.transactionType || "order" })),
      ...docs(recentRidesSnapshot, rideFields).map((item) => ({ ...item, kind: "ride" })),
      ...docs(recentParcelsSnapshot, parcelFields).map((item) => ({ ...item, kind: "send" }))
    ].sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt)).slice(0, 12);

    const supportHistory = docs(historySnapshot, ["subject", "category", "priority", "status", "assignedTo", "assignedToName", "lastMessage", "lastMessageAt", "createdAt", "updatedAt", "unreadForSupport"])
      .sort((a, b) => time(b.lastMessageAt || b.updatedAt || b.createdAt) - time(a.lastMessageAt || a.updatedAt || a.createdAt));

    const agents = usersSnapshot.docs.map((item) => {
      const data = item.data();
      const roles = Array.isArray(data.roles) ? data.roles : [];
      const permissions = Array.isArray(data.customPermissions) ? data.customPermissions : [];
      const eligible = roles.some((role) => ["super_admin", "admin", "platform_admin", "support_manager", "support_agent", "operations_manager", "regional_operations_manager"].includes(role)) || permissions.some((permission) => ["support.read", "support.respond", "support.manage", "support.*", "*"].includes(permission));
      if (!eligible || data.status === "disabled") return null;
      return { id: item.id, displayName: data.displayName || data.name || data.email || "Spotly teammate", email: data.email || "", roles };
    }).filter(Boolean).sort((a, b) => a.displayName.localeCompare(b.displayName));

    return Response.json({
      conversationId: input.conversationId,
      requester,
      business,
      related: { order, ride, parcel, delivery, claim, paymentIntent },
      recentActivity,
      supportHistory,
      agents,
      rawContext: serialize(context)
    });
  } catch (error) {
    return apiError(error, "Support context could not be loaded.");
  }
}
