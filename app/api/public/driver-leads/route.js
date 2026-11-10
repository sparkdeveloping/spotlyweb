import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimits } from "@/lib/rate-limit-server";
import { DRIVER_LEAD_RATE_POLICY } from "@/lib/driver-lead-rate-policy";
import { cleanLead, contactKey } from "@/lib/driver-leads";
import { driverAcquisitionAttribution, driverAcquisitionSlug } from "@/lib/driver-acquisition";
import { publicDriverCampaign, recordDriverAcquisitionEvent } from "@/lib/driver-acquisition-server";
import { countryCity, normalizeCountryCode } from "@/lib/country-engine";
import { publicDriverLeadFieldErrors, validateDriverLeadContact } from "@/lib/driver-lead-form-validation";

export const runtime = "nodejs";
const schema = z.object({
  lead: z.object({
    legalName: z.string().trim().min(2).max(160),
    email: z.string().max(254).default(""),
    phone: z.string().max(40).default(""),
    country: z.string().length(2),
    city: z.string().trim().max(80).default(""),
    vehicleType: z.enum(["", "bicycle", "motorcycle", "car", "van"]).default(""),
    requestedCapabilities: z.array(z.string()).max(8).default([]),
  }).strict(),
  campaign: z.string().max(96).default(""),
  sessionId: z.string().min(8).max(120),
  attribution: z.record(z.string(), z.unknown()).default({}),
  licenceStatus: z.enum(["", "yes", "no", "learning", "not_sure"]).default(""),
  contactPreference: z.enum(["phone", "whatsapp", "email", "either"]).default("either"),
  contactConsent: z.literal(true),
}).strict();

const hashSession = (value) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 32);

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    const body = schema.parse(await request.json());
    const contactErrors = validateDriverLeadContact(body.lead);
    if (Object.keys(contactErrors).length) return Response.json({ ok: false, error: "Correct the highlighted contact details and try again.", fieldErrors: contactErrors }, { status: 400 });
    const canonicalCountry = normalizeCountryCode(body.lead.country);
    const canonicalCity = countryCity(canonicalCountry, body.lead.city);
    if (!canonicalCountry || !canonicalCity) throw Object.assign(new Error("Choose a supported country and city."), { status: 400 });
    const lead = cleanLead({ ...body.lead, country: canonicalCountry, city: canonicalCity.name, vehicleMake: "", vehicleModel: "", vehicleRegistration: "", licenceReference: "", preferredZones: [], notes: "" });
    // Limit repeated attempts by the validated, normalized contact details rather than
    // treating everyone on a carrier-grade NAT or office Wi-Fi as one applicant.
    // The much higher network-level cap still stops high-volume public abuse.
    const contactIdentity = lead.phone ? contactKey("phone", lead.phone) : contactKey("email", lead.email);
    await enforceRateLimits(request, [
      { ...DRIVER_LEAD_RATE_POLICY.contact, identity: contactIdentity },
      DRIVER_LEAD_RATE_POLICY.network,
    ]);
    const { db, auth } = getAdminServices();
    const campaignSlug = driverAcquisitionSlug(body.campaign);
    const campaign = campaignSlug ? await publicDriverCampaign(db, campaignSlug) : null;
    const attribution = driverAcquisitionAttribution(body.attribution);
    const touchpoint = {
      source: "public_driver_acquisition",
      campaignSlug: campaign?.id || campaignSlug || "organic",
      campaignName: campaign?.name || "",
      placement: campaign?.placement || "",
      medium: campaign?.medium || attribution.utm_medium || "",
      country: lead.country,
      city: lead.city,
      attribution,
      licenceStatus: body.licenceStatus,
      contactPreference: body.contactPreference,
      contactConsent: true,
      sessionHash: hashSession(body.sessionId),
      createdAt: FieldValue.serverTimestamp(),
    };
    const keys = [lead.email && contactKey("email", lead.email), lead.phone && contactKey("phone", lead.phone)].filter(Boolean);
    const contactRefs = keys.map((key) => db.collection("driverLeadContacts").doc(key));
    let existingApplication = false;
    try {
      for (const lookup of [
        lead.email ? () => auth.getUserByEmail(lead.email) : null,
        lead.phone ? () => auth.getUserByPhoneNumber(lead.phone) : null,
      ].filter(Boolean)) {
        try {
          const user = await lookup();
          if ((await db.collection("driverApplications").doc(user.uid).get()).exists) { existingApplication = true; break; }
        } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
      }
    } catch { /* Public acquisition should still accept the handoff if Auth lookup is temporarily unavailable. */ }

    let created = false;
    let leadId = "";
    await db.runTransaction(async (tx) => {
      const contacts = await Promise.all(contactRefs.map((ref) => tx.get(ref)));
      const existingContact = contacts.find((item) => item.exists);
      if (existingContact) {
        leadId = existingContact.data()?.leadId || "";
        if (leadId) {
          const ref = db.collection("driverLeads").doc(leadId);
          const current = await tx.get(ref);
          if (current.exists && current.data()?.status === "awaiting_claim") {
            tx.set(ref, { lastAcquisition: touchpoint, acquisitionTouchCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            tx.create(db.collection("driverLeadTouchpoints").doc(), { leadId, ...touchpoint });
          }
        }
        return;
      }
      if (existingApplication) return;
      const ref = db.collection("driverLeads").doc();
      leadId = ref.id;
      created = true;
      tx.create(ref, {
        ...lead,
        status: "awaiting_claim",
        assignedTo: null,
        createdBy: "public_driver_acquisition",
        lastEditedBy: "public_driver_acquisition",
        source: "public_driver_acquisition",
        acquisition: touchpoint,
        lastAcquisition: touchpoint,
        acquisitionTouchCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      contactRefs.forEach((contact) => tx.create(contact, { leadId: ref.id, createdAt: FieldValue.serverTimestamp() }));
      tx.create(db.collection("driverLeadTouchpoints").doc(), { leadId: ref.id, ...touchpoint });
      tx.create(db.collection("auditLogs").doc(), {
        action: "driver_lead.public_submitted",
        entityType: "driverLead",
        entityId: ref.id,
        actorId: "public",
        metadata: { campaignSlug: touchpoint.campaignSlug, country: lead.country, city: lead.city, vehicleType: lead.vehicleType },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await recordDriverAcquisitionEvent(db, { event: "submission", campaign, campaignSlug, sessionId: body.sessionId, attribution, country: lead.country, city: lead.city }).catch(() => null);
    if (created) await recordDriverAcquisitionEvent(db, { event: "new_lead", campaign, campaignSlug, sessionId: body.sessionId, attribution, country: lead.country, city: lead.city }).catch(() => null);
    return Response.json({ ok: true, received: true });
  } catch (error) {
    if (error?.status === 429 && error?.code === "rate-limited") {
      const scope = error.scope === "network" ? "network" : "contact";
      const retryAfterSeconds = Math.max(1, Number(error.retryAfterSeconds) || 60);
      const message = scope === "network"
        ? "This internet connection has reached its temporary signup limit."
        : "These contact details have been submitted too often."; 
      return Response.json({ ok: false, error: message, code: "rate-limited", scope, retryAfterSeconds }, {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
      });
    }
    if (error instanceof z.ZodError) {
      const fieldErrors = publicDriverLeadFieldErrors(error.issues);
      return Response.json({
        ok: false,
        error: Object.keys(fieldErrors).length ? "Correct the highlighted details and try again." : "The form could not be validated. Refresh the page and try again.",
        fieldErrors,
      }, { status: 400 });
    }
    return apiError(error);
  }
}
