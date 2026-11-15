import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only bounded incident stream; no automatic background subscription. */
export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    requirePlatformPermission(user, "support.read", { roles: ["support_agent", "support_manager"] });
    const { db } = getAdminServices();
    const snapshot = await db.collection("clientIncidents").orderBy("createdAt", "desc").limit(40).get();
    const incidents = snapshot.docs.map((document) => {
      const item = document.data() || {};
      return {
        id: document.id, platform: item.platform || "web", kind: item.kind || "render_failure",
        severity: item.severity || "high", status: item.status || "open", screen: item.screen || "/",
        errorClass: item.errorClass || "Other", fingerprint: item.fingerprint || null,
        digest: item.digest || null, linkedConversationId: item.linkedConversationId || null, createdAt: item.createdAt?.toDate?.().toISOString?.() || null,
      };
    });
    return Response.json({ ok: true, incidents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
