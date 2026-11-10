import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";

function millis(value) { return value?.toMillis?.() || value?.toDate?.()?.getTime?.() || 0; }
function ageMinutes(value, now = Date.now()) { const time = millis(value); return time ? Math.max(0, Math.round((now - time) / 60_000)) : null; }

export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "admin.configuration");
    const { db } = getAdminServices();
    const now = Date.now();
    const [settingsSnapshot, presenceSnapshot, incidentSnapshot, orderSnapshot, securityRateSnapshot, publicRateSnapshot, auditSnapshot] = await Promise.all([
      db.collection("platformSettings").doc("global").get(),
      db.collection("driverPresence").limit(300).get(),
      db.collection("driverIncidents").limit(300).get(),
      db.collection("orders").limit(600).get(),
      db.collection("securityRateLimits").limit(300).get(),
      db.collection("rateLimits").limit(300).get(),
      db.collection("auditLogs").orderBy("createdAt", "desc").limit(100).get()
    ]);
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    const stalePresence = presenceSnapshot.docs.map((doc) => doc.data()).filter((row) => ["online", "paused", "active"].includes(row.state) && (ageMinutes(row.updatedAt || row.locationUpdatedAt, now) ?? 9999) > 15).length;
    const unresolvedIncidents = incidentSnapshot.docs.map((doc) => doc.data()).filter((row) => !["resolved", "closed", "dismissed"].includes(String(row.status || "open"))).length;
    const paymentExceptions = orderSnapshot.docs.map((doc) => doc.data()).filter((row) => ["failed", "refund_pending", "refund_failed", "review_required"].includes(String(row.paymentStatus || ""))).length;
    const recentRatePressure = [...securityRateSnapshot.docs, ...publicRateSnapshot.docs].map((doc) => doc.data()).filter((row) => {
      const updated = millis(row.updatedAt); return updated && now - updated < 15 * 60_000 && Number(row.count || 0) >= 8;
    }).length;
    const recentAudits = auditSnapshot.docs.map((doc) => doc.data()).filter((row) => { const created = millis(row.createdAt); return created && now - created < 24 * 60 * 60_000; }).length;
    const appCheckEnforced = process.env.SPOTLY_ENFORCE_APP_CHECK === "true";
    const auditRetentionDays = Math.min(Math.max(Number(settings.security?.auditRetentionDays || 730), 90), 2555);

    return Response.json({
      ok: true,
      generatedAt: new Date(now).toISOString(),
      health: {
        appCheckEnforced,
        structuredLogging: true,
        auditRetentionDays,
        driverLocationRetentionMinutes: 30,
        staleDriverPresence: stalePresence,
        unresolvedDriverIncidents: unresolvedIncidents,
        paymentExceptions,
        recentRatePressure,
        recentAuditEvents: recentAudits
      }
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
