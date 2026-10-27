import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
export const runtime = "nodejs";
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "admin.access");
    const input = String(new URL(request.url).searchParams.get("email") || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || input.length > 254) return Response.json({ ok: false, error: "Enter the account's full email address." }, { status: 400 });
    const { db } = getAdminServices();
    const snapshot = await db.collection("users").where("email", "==", input).limit(1).get();
    if (snapshot.empty) return Response.json({ ok: false, error: "No account was found for this email. Ask the team member to create their Spotly account first." }, { status: 404 });
    const d = snapshot.docs[0]; const item = d.data();
    return Response.json({ ok: true, user: { id: d.id, uid: d.id, email: item.email || "", displayName: item.displayName || "", roles: item.roles || ["customer"],
      customPermissions: item.customPermissions || [], status: item.status || "active", privateBeta: Boolean(item.privateBeta), providers: item.providers || [] } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
