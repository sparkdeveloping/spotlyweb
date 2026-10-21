import { NextResponse } from "next/server";
import { authenticateRequest, getAdminServices, apiError } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "driver_operations_coordinator"];

/**
 * Limited, role-gated account discovery for Ride Lab invitations.
 * Never return phone, UID, roles, custom permissions or private profiles.
 * Firebase Auth is authoritative for whether a tester's email is verified.
 */
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ROLES });
    await enforceRateLimit(request, { key: "ride_lab_tester_lookup", limit: 12, windowMs: 60_000, identity: actor.uid });
    const search = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
    if (search.length < 2 || search.length > 80) {
      return NextResponse.json({ ok: true, accounts: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const { auth } = getAdminServices();
    // Small bounded directory read, capped to prevent unbounded account enumeration.
    const listed = await auth.listUsers(500);
    const accounts = listed.users.filter((item) => !item.disabled && item.email &&
      (item.email.toLowerCase().includes(search) || String(item.displayName || "").toLowerCase().includes(search)))
      .slice(0, 15)
      .map((item) => ({
        email: item.email.toLowerCase(), name: item.displayName || "Spotly account",
        verified: item.emailVerified === true
      }));
    return NextResponse.json({ ok: true, accounts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
