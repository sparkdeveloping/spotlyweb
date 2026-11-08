import { z } from "zod";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { driverAcquisitionSlug, DRIVER_ACQUISITION_EVENTS } from "@/lib/driver-acquisition";
import { publicDriverCampaign, recordDriverAcquisitionEvent } from "@/lib/driver-acquisition-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const eventSchema = z.object({
  event: z.enum(DRIVER_ACQUISITION_EVENTS.filter((value) => value !== "new_lead")),
  campaign: z.string().max(96).default(""),
  sessionId: z.string().min(8).max(120),
  attribution: z.record(z.string(), z.unknown()).default({}),
  country: z.string().max(8).default(""),
  city: z.string().max(100).default(""),
}).strict();
const noStore = { "Cache-Control": "public, max-age=0, no-store" };

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request);
    await enforceRateLimit(request, { key: "public-driver-acquisition-config", limit: 60, windowMs: 10 * 60_000 });
    const slug = driverAcquisitionSlug(new URL(request.url).searchParams.get("campaign") || "");
    if (!slug) return Response.json({ ok: true, campaign: null }, { headers: noStore });
    const campaign = await publicDriverCampaign(getAdminServices().db, slug);
    if (!campaign || campaign.status !== "active") return Response.json({ ok: true, campaign: null }, { headers: noStore });
    return Response.json({ ok: true, campaign: {
      slug: campaign.id,
      name: campaign.name || "Spotly Driver",
      country: campaign.country || "",
      city: campaign.city || "",
      medium: campaign.medium || "other",
    } }, { headers: noStore });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    await enforceRateLimit(request, { key: "public-driver-acquisition-event", limit: 40, windowMs: 10 * 60_000 });
    const body = eventSchema.parse(await request.json());
    const { db } = getAdminServices();
    const campaign = body.campaign ? await publicDriverCampaign(db, body.campaign) : null;
    await recordDriverAcquisitionEvent(db, { ...body, campaign, campaignSlug: body.campaign });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid acquisition event." }, { status: 400 });
    return apiError(error);
  }
}
