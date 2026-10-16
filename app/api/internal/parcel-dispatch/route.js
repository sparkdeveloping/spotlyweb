import { FieldValue } from "firebase-admin/firestore";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { dispatchParcel } from "@/lib/parcel-server";
import { effectiveSecret } from "@/lib/platform-secrets-server";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const secret = await effectiveSecret("scheduler", "secret", ["CRON_SECRET"]); const authorization = request.headers.get("authorization") || "";
    if (!secret || authorization !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { db, messaging } = getAdminServices();
    const scheduled = await db.collection("parcelJobs").where("state", "==", "scheduled").limit(100).get();
    const dueCutoff = Date.now() + 15 * 60_000;
    for (const scheduledDoc of scheduled.docs) {
      const scheduledMs = scheduledDoc.data().scheduledPickupAt?.toMillis?.() || 0;
      if (!scheduledMs || scheduledMs > dueCutoff) continue;
      await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(scheduledDoc.ref); if (!fresh.exists || fresh.data().state !== "scheduled") return;
        const data = fresh.data(); const now = FieldValue.serverTimestamp();
        transaction.set(scheduledDoc.ref, { state: "searching_driver", dispatchAttemptedAt: null, updatedAt: now }, { merge: true });
        if (data.orderId) transaction.set(db.collection("orders").doc(data.orderId), { sendStatus: "searching_driver", status: "requested", updatedAt: now }, { merge: true });
        transaction.create(db.collection("parcelEvents").doc(), { parcelJobId: scheduledDoc.id, type: "dispatch.scheduled_due", actorType: "system", actorId: "parcel_dispatch_cron", previousState: "scheduled", state: "searching_driver", createdAt: now });
      });
    }
    const jobs = await db.collection("parcelJobs").where("state", "==", "searching_driver").limit(50).get(); const results = [];
    for (const doc of jobs.docs) { const data = doc.data(); if (data.assignedDriverId) continue; const attempted = data.dispatchAttemptedAt?.toMillis?.() || 0; if (attempted && Date.now() - attempted < 45000) continue; try { results.push({ parcelJobId: doc.id, ...(await dispatchParcel({ db, messaging, parcelJobId: doc.id, actorId: "parcel_dispatch_cron" })) }); } catch (error) { results.push({ parcelJobId: doc.id, error: String(error?.message || "dispatch_failed") }); } }
    return Response.json({ ok: true, checked: jobs.size, results });
  } catch (error) { return apiError(error); }
}
