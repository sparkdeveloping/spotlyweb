import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { dispatchRide } from "@/lib/ride-server";
import { effectiveSecret } from "@/lib/platform-secrets-server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authorized(request) {
  const secret = await effectiveSecret("scheduler", "secret", ["CRON_SECRET"]);
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  try {
    if (!(await authorized(request))) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { db, messaging } = getAdminServices();
    const snapshot = await db.collection("rideTrips").where("state", "==", "searching_driver").limit(100).get();
    const results = [];
    for (const doc of snapshot.docs) {
      try {
        const result = await dispatchRide({ db, messaging, rideId: doc.id, actorId: "ride-dispatch-cron" });
        results.push({ rideId: doc.id, ok: true, offered: Number(result.offered || 0) });
      } catch (error) {
        results.push({ rideId: doc.id, ok: false, error: String(error?.message || "Dispatch failed").slice(0, 300) });
      }
    }
    return Response.json({ ok: true, checked: snapshot.size, results });
  } catch (error) { return apiError(error); }
}
