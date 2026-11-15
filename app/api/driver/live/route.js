import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { driverLiveSnapshot } from "@/lib/driver-live-server";
import { recordCostEvent } from "@/lib/cost-observability-server";

export const runtime = "nodejs";

// User-specific live driver activity. Never cache or expose this as a public feed.
export async function GET(request) {
  const startedAt = Date.now();
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const result = await driverLiveSnapshot(db, user.uid);
    recordCostEvent("driver.live", { durationMs: Date.now() - startedAt, queryCount: 7, estimatedReadFloor: result.estimatedReadFloor });
    return Response.json({ ok: true, ...result.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
