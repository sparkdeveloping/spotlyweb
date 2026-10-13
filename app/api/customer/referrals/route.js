import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { claimReferral, referralOverview } from "@/lib/referral-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), code: z.string().min(6).max(12) }),
  z.object({ action: z.literal("refresh") })
]);

function response(payload, init = {}) {
  return Response.json(payload, { ...init, headers: { "Cache-Control": "private, no-store", ...(init.headers || {}) } });
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "customer-referrals-read", limit: 90, windowMs: 60_000, identity: user.uid });
    const { db } = getAdminServices();
    return response({ ok: true, ...(await referralOverview(db, user.uid)) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    if (user.firebase?.sign_in_provider === "anonymous") throw Object.assign(new Error("Create or sign in to a full Spotly account to use referrals."), { status: 403 });
    await enforceRateLimit(request, { key: "customer-referrals-write", limit: 12, windowMs: 15 * 60_000, identity: user.uid });
    const body = actionSchema.parse(await request.json());
    const { db } = getAdminServices();
    if (body.action === "claim") await claimReferral(db, { userId: user.uid, code: body.code });
    return response({ ok: true, ...(await referralOverview(db, user.uid)) });
  } catch (error) {
    if (error instanceof z.ZodError) return response({ ok: false, error: "Review the referral details." }, { status: 400 });
    return apiError(error);
  }
}
