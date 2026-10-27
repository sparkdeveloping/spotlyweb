import { z } from "zod";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { normalizeAttribution } from "@/lib/first-access";
import { acquisitionRollup } from "@/lib/first-access-server";

export const runtime = "nodejs";
const schema = z.object({ event: z.enum(["view", "signup_start"]), attribution: z.record(z.string(), z.string().max(300)).optional().default({}) }).strict();
export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    const data = schema.parse(await request.json());
    // First-party, session-scoped counts only. No IP, user agent, or visitor identifier is stored.
    await enforceRateLimit(request, { key: "first-access-event", limit: 600, windowMs: 15 * 60_000 });
    await acquisitionRollup(getAdminServices().db, data.event, normalizeAttribution(data.attribution));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid event." }, { status: 400 });
    return apiError(error);
  }
}
