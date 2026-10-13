import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { plain } from "@/lib/driver-delivery-server";

export const runtime = "nodejs";
const schema = z.object({ orderId: z.string().min(3).max(180) });

function firstName(driver = {}) {
  const source = driver.displayName || driver.legalName || driver.name || "Your Driver";
  return String(source).trim().split(/\s+/)[0] || "Your Driver";
}

function deliveryStateMessage(state, shoppingMode) {
  const labels = {
    awaiting_payment: "Waiting for payment",
    awaiting_dispatch: "Finding a Driver",
    searching_driver: "Finding a Driver",
    driver_assigned: "Driver assigned",
    driver_to_pickup: shoppingMode ? "Driver going to the store" : "Driver going to pickup",
    driver_arrived_pickup: shoppingMode ? "Driver arrived at the store" : "Driver arrived for pickup",
    shopping: "Driver is shopping",
    shopping_review: "Reviewing the shopping basket",
    pickup_verification: "Confirming pickup",
    collected: "Order collected",
    en_route: "On the way",
    driver_arrived_customer: "Driver has arrived",
    handoff_verification: "Confirming delivery",
    delivered: "Delivered",
    failed: "Delivery needs attention",
    cancelled: "Delivery cancelled",
    returned: "Order returned"
  };
  return labels[state] || "Order in progress";
}

function customerPinVisible(state) {
  return ["en_route", "driver_arrived_customer", "handoff_verification"].includes(state);
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const orderSnapshot = await db.collection("orders").doc(body.orderId).get();
    if (!orderSnapshot.exists) throw Object.assign(new Error("The order was not found."), { status: 404 });
    const order = orderSnapshot.data() || {};
    if (order.customerId !== user.uid) throw Object.assign(new Error("You cannot view this order."), { status: 403 });

    let delivery = null;
    if (order.deliveryJobId) {
      const jobSnapshot = await db.collection("deliveryJobs").doc(order.deliveryJobId).get();
      if (jobSnapshot.exists) {
        const job = jobSnapshot.data() || {};
        const shoppingMode = job.fulfilmentMode === "driver_shops";
        let driver = null;
        let driverLocation = null;
        if (job.assignedDriverId) {
          const [driverSnapshot, presenceSnapshot, vehicleQuery] = await Promise.all([
            db.collection("drivers").doc(job.assignedDriverId).get(),
            db.collection("driverPresence").doc(job.assignedDriverId).get(),
            db.collection("driverVehicles").where("driverId", "==", job.assignedDriverId).limit(10).get()
          ]);
          const driverData = driverSnapshot.exists ? driverSnapshot.data() || {} : {};
          const vehicles = vehicleQuery.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
          const vehicle = vehicles.find((item) => item.status === "approved") || vehicles[0] || null;
          driver = {
            id: job.assignedDriverId,
            firstName: firstName(driverData),
            photoURL: driverData.photoURL || driverData.profilePhotoURL || "",
            rating: Number.isFinite(Number(driverData.rating)) ? Number(driverData.rating) : null,
            vehicle: vehicle ? {
              type: vehicle.type || "",
              make: vehicle.make || "",
              model: vehicle.model || "",
              color: vehicle.color || "",
              registration: vehicle.registration || ""
            } : null
          };
          const presence = presenceSnapshot.exists ? presenceSnapshot.data() || {} : null;
          const current = presence?.currentLocation;
          const updatedAt = presence?.locationUpdatedAt?.toDate?.() || null;
          const fresh = updatedAt && Date.now() - updatedAt.getTime() <= 5 * 60_000;
          if (fresh && current && Number.isFinite(Number(current.lat)) && Number.isFinite(Number(current.lng))) {
            driverLocation = { lat: Number(current.lat), lng: Number(current.lng), accuracy: Number(current.accuracy || 0), updatedAt: updatedAt.toISOString() };
          }
        }

        delivery = {
          id: jobSnapshot.id,
          number: job.number || order.deliveryNumber || "",
          state: job.state || order.deliveryStatus || "awaiting_dispatch",
          stateLabel: deliveryStateMessage(job.state || order.deliveryStatus, shoppingMode),
          fulfilmentMode: job.fulfilmentMode || "merchant_prepared",
          pickup: { area: job.pickup?.area || "", formattedAddress: job.pickup?.formattedAddress || "" },
          dropoff: { suburb: job.dropoff?.suburb || "", formattedAddress: job.dropoff?.formattedAddress || "" },
          driver,
          driverLocation,
          customerPin: customerPinVisible(job.state) ? String(job.customerPin || "") : "",
          shopping: shoppingMode ? {
            state: job.shopping?.state || order.shopping?.state || "",
            estimatedSubtotal: Number(job.shopping?.estimatedSubtotal ?? order.shopping?.estimatedSubtotal ?? 0),
            maxAuthorizedMerchandise: Number(job.shopping?.maxAuthorizedMerchandise ?? order.shopping?.maxAuthorizedMerchandise ?? 0),
            actualSubtotal: order.shopping?.actualSubtotal == null ? null : Number(order.shopping.actualSubtotal),
            unusedReserve: order.shopping?.unusedReserve == null ? null : Number(order.shopping.unusedReserve),
            substitutionPreference: job.shopping?.substitutionPreference || order.shopping?.substitutionPreference || "contact_me"
          } : null,
          updatedAt: plain(job.updatedAt || order.updatedAt || null)
        };
      }
    }

    return Response.json({
      ok: true,
      order: {
        id: orderSnapshot.id,
        number: order.number || orderSnapshot.id,
        businessId: order.businessId || "",
        businessName: order.businessName || "Business",
        branchId: order.branchId || "",
        branchName: order.branchName || "",
        status: order.status || "submitted",
        paymentStatus: order.paymentStatus || "unpaid",
        fulfilment: order.fulfilment || "pickup",
        deliveryStatus: order.deliveryStatus || null,
        currency: order.currency || "USD",
        totals: plain(order.totals || { total: Number(order.total || 0) }),
        items: plain(order.items || []),
        pickup: plain(order.pickup || null),
        delivery: plain(order.delivery || null),
        shopping: plain(order.shopping || null),
        createdAt: plain(order.createdAt || null),
        updatedAt: plain(order.updatedAt || null)
      },
      delivery
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The order identifier is invalid." }, { status: 400 });
    return apiError(error);
  }
}
