import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { canManageDriverLeads } from "@/lib/driver-leads";
import { countryCity, countryDefinition, normalizeCountryCode } from "@/lib/country-engine";
import { driverAcquisitionSlug, driverAcquisitionUrl, DRIVER_ACQUISITION_MEDIA } from "@/lib/driver-acquisition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const createSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(3).max(120),
  country: z.string().length(2),
  city: z.string().trim().min(2).max(80),
  placement: z.string().trim().min(2).max(140),
  medium: z.enum(DRIVER_ACQUISITION_MEDIA),
  notes: z.string().trim().max(800).default(""),
  slug: z.string().trim().max(72).optional().default(""),
}).strict();
const statusSchema = z.object({ action: z.enum(["pause", "resume", "archive"]), slug: z.string().min(1).max(72) }).strict();
const mutationSchema = z.union([createSchema, statusSchema]);

function deny() { throw Object.assign(new Error("You cannot manage Driver acquisition campaigns."), { status: 403 }); }
function timestamp(value) { return value?.toDate?.()?.toISOString?.() || null; }
function accumulate(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (typeof value === "number") target[key] = (target[key] || 0) + value;
    else if (value && typeof value === "object" && !Array.isArray(value) && typeof value.toDate !== "function") { target[key] ||= {}; accumulate(target[key], value); }
  }
}
function aggregateMetrics(docs) {
  const byCampaign = new Map();
  const totals = { views: 0, starts: 0, contactCompletes: 0, submissions: 0, newLeads: 0, channels: {}, countries: {}, cities: {} };
  for (const doc of docs) {
    const value = doc.data() || {};
    const slug = value.campaignSlug || "organic";
    if (!byCampaign.has(slug)) byCampaign.set(slug, { campaignSlug: slug, views: 0, starts: 0, contactCompletes: 0, submissions: 0, newLeads: 0, channels: {}, countries: {}, cities: {} });
    const target = byCampaign.get(slug);
    for (const field of ["views", "starts", "contactCompletes", "submissions", "newLeads", "channels", "countries", "cities"]) {
      if (value[field] != null) { accumulate(target, { [field]: value[field] }); accumulate(totals, { [field]: value[field] }); }
    }
  }
  return { totals, campaigns: [...byCampaign.values()] };
}

export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!canManageDriverLeads(actor.profile)) deny();
    const { db } = getAdminServices();
    const days = Math.min(90, Math.max(7, Number.parseInt(new URL(request.url).searchParams.get("days") || "30", 10) || 30));
    const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const [campaignSnapshot, metricsSnapshot] = await Promise.all([
      db.collection("driverAcquisitionCampaigns").orderBy("createdAt", "desc").limit(250).get(),
      db.collection("driverAcquisitionMetrics").where("day", ">=", start).orderBy("day").limit(5000).get(),
    ]);
    const metrics = aggregateMetrics(metricsSnapshot.docs);
    const metricMap = new Map(metrics.campaigns.map((item) => [item.campaignSlug, item]));
    const campaigns = campaignSnapshot.docs.map((doc) => {
      const value = doc.data() || {};
      const stats = metricMap.get(doc.id) || { views: 0, starts: 0, contactCompletes: 0, submissions: 0, newLeads: 0, channels: {}, countries: {}, cities: {} };
      return { slug: doc.id, ...value, createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt), url: driverAcquisitionUrl(doc.id), metrics: stats };
    });
    return Response.json({ ok: true, days, campaigns, totals: metrics.totals, organic: metricMap.get("organic") || null, metricsTruncated: metricsSnapshot.size >= 5000 }, { headers: noStore });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!canManageDriverLeads(actor.profile)) deny();
    const body = mutationSchema.parse(await request.json());
    const { db } = getAdminServices();
    if (body.action === "create") {
      const country = normalizeCountryCode(body.country);
      const city = countryCity(country, body.city);
      if (!country || !countryDefinition(country) || !city) throw Object.assign(new Error("Choose a supported country and city."), { status: 400 });
      const base = driverAcquisitionSlug(body.slug || `${city.name}-${body.placement}-${body.name}`) || "driver-campaign";
      let slug = base;
      let ref = db.collection("driverAcquisitionCampaigns").doc(slug);
      if ((await ref.get()).exists) {
        slug = `${base.slice(0, 64)}-${randomBytes(3).toString("hex")}`;
        ref = db.collection("driverAcquisitionCampaigns").doc(slug);
      }
      const now = FieldValue.serverTimestamp();
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) throw Object.assign(new Error("That campaign code already exists. Try a different label."), { status: 409 });
        tx.create(ref, { name: body.name, country, city: city.name, cityId: city.id, placement: body.placement, medium: body.medium, notes: body.notes, status: "active", createdBy: actor.uid, updatedBy: actor.uid, createdAt: now, updatedAt: now });
        tx.create(db.collection("auditLogs").doc(), { action: "driver_acquisition.campaign_created", entityType: "driverAcquisitionCampaign", entityId: slug, actorId: actor.uid, actorEmail: actor.email || "", metadata: { country, city: city.name, placement: body.placement, medium: body.medium }, createdAt: now });
      });
      return Response.json({ ok: true, campaign: { slug, url: driverAcquisitionUrl(slug) } });
    }
    const slug = driverAcquisitionSlug(body.slug);
    const ref = db.collection("driverAcquisitionCampaigns").doc(slug);
    const status = body.action === "pause" ? "paused" : body.action === "resume" ? "active" : "archived";
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error("Driver acquisition campaign not found."), { status: 404 });
      tx.update(ref, { status, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("auditLogs").doc(), { action: `driver_acquisition.campaign_${body.action}`, entityType: "driverAcquisitionCampaign", entityId: slug, actorId: actor.uid, actorEmail: actor.email || "", metadata: { previousStatus: snapshot.data()?.status || "active", nextStatus: status }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, status });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the campaign details and try again." }, { status: 400 });
    return apiError(error);
  }
}
