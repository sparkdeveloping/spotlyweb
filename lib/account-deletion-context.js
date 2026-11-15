// Shared authenticated account-deletion blocker discovery. Never delete any records here.
const terminal = new Set(["completed", "delivered", "cancelled", "canceled", "failed", "refunded", "expired", "rejected", "returned", "closed"]);
const assistShoppingTerminal = new Set(["completed", "cancelled", "canceled", "declined", "expired", "refunded", "closed"]);
const assistBookingTerminal = new Set(["completed", "cancelled", "canceled", "declined", "expired", "closed"]);

function activeCount(snapshot, field, terminalStates = terminal, filter = () => true) {
  return snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    return filter(data) && !terminalStates.has(String(data[field] || "").toLowerCase());
  }).length;
}

export async function deletionContext(db, userId) {
  const [rides, parcels, orders, shopping, bookings, existing] = await Promise.all([
    db.collection("rideTrips").where("customerId", "==", userId).limit(100).get(),
    db.collection("parcelJobs").where("customerId", "==", userId).limit(100).get(),
    db.collection("orders").where("customerId", "==", userId).limit(200).get(),
    db.collection("independentShoppingRequests").where("customerId", "==", userId).limit(100).get(),
    db.collection("assistedBookings").where("customerId", "==", userId).limit(100).get(),
    db.collection("accountDeletionRequests").doc(userId).get()
  ]);
  // Ride and Send create linked orders. Exclude those linked order shells here so one
  // active customer transaction is never presented as two separate blockers.
  const activeOrderCount = activeCount(orders, "status", terminal, (order) => !["ride", "send"].includes(String(order.transactionType || "").toLowerCase()));
  const blockers = {
    activeRideCount: activeCount(rides, "state"),
    activeParcelCount: activeCount(parcels, "state"),
    activeOrderCount,
    activeAssistShoppingCount: activeCount(shopping, "state", assistShoppingTerminal),
    activeAssistBookingCount: activeCount(bookings, "state", assistBookingTerminal)
  };
  // At most one record per query: we need a safe deletion hold, not an expensive
  // merchant portfolio report. Both ownership and staff access must be reviewed.
  const [membership, owned] = await Promise.all([
    db.collection("memberships").where("userId", "==", userId).limit(1).get(),
    db.collection("businesses").where("ownerIds", "array-contains", userId).limit(1).get()
  ]);
  blockers.businessAccessReviewRequired = !membership.empty || !owned.empty;
  blockers.total = Object.entries(blockers).filter(([key]) => key !== "total" && key !== "businessAccessReviewRequired")
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const request = existing.exists ? existing.data() || {} : null;
  return { blockers, request };
}

