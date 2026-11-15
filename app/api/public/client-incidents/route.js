import { randomBytes, createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { normalizeClientIncident } from "@/lib/incident-policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Explicit opt-in: this is not a second, anonymous support ticket system.
// App Check is mandatory even if the rest of the project is in observation mode.
// Never accept raw browser stack traces, error messages, URLs or arbitrary context.
export async function POST(request) {
  if (process.env.SPOTLY_INCIDENT_INGEST_ENABLED !== "true") {
    return Response.json({ ok: false, error: "Reporting is not available." }, { status: 503 });
  }
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2048) return Response.json({ ok: false, error: "Request is too large." }, { status: 413 });
    await verifyAppCheckRequest(request, { required: true });
    await enforceRateLimit(request, { key: "client-incident-report", limit: 3, windowMs: 10 * 60_000 });
    const raw = await request.text();
    if (raw.length > 2048) return Response.json({ ok: false, error: "Request is too large." }, { status: 413 });
    let payload;
    try { payload = JSON.parse(raw); } catch { return Response.json({ ok: false, error: "Invalid report." }, { status: 400 }); }
    const input = normalizeClientIncident(payload);
    if (!input) return Response.json({ ok: false, error: "Invalid report." }, { status: 400 });
    const { db } = getAdminServices();
    const id = `SI-${randomBytes(6).toString("hex").toUpperCase()}`;
    const fingerprint = createHash("sha256")
      .update([input.surface, input.errorClass, input.digest || "", input.screen].join("|"))
      .digest("hex").slice(0, 24);
    await db.collection("clientIncidents").doc(id).create({
      platform: "web", source: "automatic", kind: "render_failure", severity: "high",
      surface: input.surface, errorClass: input.errorClass, digest: input.digest,
      screen: input.screen, fingerprint, status: "open", createdAt: FieldValue.serverTimestamp(),
      // No IP, auth header, coordinates, name, URL params, message or stack.
    });
    return Response.json({ ok: true, incidentId: id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
