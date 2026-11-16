import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText, toPlainTimestamp } from "@/lib/server-helpers";
import { countryCity, normalizeCountryCode } from "@/lib/country-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "businessRegistrations";
const DEFAULT_ADMIN_PASSWORD = "spotly-admin-2026";

const createSchema = z.object({
  applicantName: z.string().trim().min(2, "Enter your full name.").max(160),
  phone: z.string().trim().min(5, "Enter a valid phone or WhatsApp number.").max(40),
  email: z.string().trim().email("Enter a valid email address.").max(254).or(z.literal("")).optional().default(""),
  roleAtBusiness: z.enum(["owner", "manager", "authorized_representative", "other"]).optional().default("owner"),
  contactPreference: z.enum(["whatsapp", "phone", "email"]).optional().default("whatsapp"),
  businessName: z.string().trim().min(2, "Enter your business name.").max(180),
  registrationStatus: z.enum(["registered", "in_process", "not_registered"]),
  category: z.string().trim().min(1, "Select a business category.").max(100),
  country: z.string().trim().min(2).max(2),
  city: z.string().trim().min(2, "Select or enter your city or town.").max(100),
  notes: z.string().trim().max(1000).optional().default("")
});

const patchSchema = z.object({
  id: z.string().trim().min(1).max(180),
  seen: z.boolean().optional(),
  status: z.enum(["new", "seen", "contacted"]).optional()
});

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest();
}

function requireRegistrationsPassword(request) {
  const configured = process.env.SPOTLY_REGISTRATIONS_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const provided = request.headers.get("x-registrations-password") || "";
  if (!provided || !timingSafeEqual(sha256(provided), sha256(configured))) {
    throw Object.assign(new Error("Invalid admin password."), { status: 401 });
  }
}

function serializeRegistration(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    applicantName: data.applicantName || "",
    phone: data.phone || "",
    email: data.email || "",
    roleAtBusiness: data.roleAtBusiness || "owner",
    contactPreference: data.contactPreference || "whatsapp",
    businessName: data.businessName || "",
    registrationStatus: data.registrationStatus || "not_registered",
    category: data.category || "Other",
    country: data.country || "ZW",
    city: data.city || "",
    notes: data.notes || "",
    seen: Boolean(data.seen),
    status: data.status || (data.seen ? "seen" : "new"),
    seenAt: toPlainTimestamp(data.seenAt),
    contactedAt: toPlainTimestamp(data.contactedAt),
    createdAt: toPlainTimestamp(data.createdAt),
    updatedAt: toPlainTimestamp(data.updatedAt)
  };
}

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    const rate = await enforceRateLimit(request, { key: "public-business-registration", limit: 15, windowMs: 30 * 60_000 });
    const values = createSchema.parse(await request.json());

    const country = normalizeCountryCode(values.country);
    if (!country) {
      return Response.json({ ok: false, error: "Choose a supported country." }, { status: 400 });
    }
    if (values.contactPreference === "email" && !values.email) {
      return Response.json({ ok: false, error: "Enter an email address when email is your preferred contact method." }, { status: 400 });
    }

    const matchedCity = countryCity(country, values.city);
    const cityName = matchedCity ? matchedCity.name : safeText(values.city, 100);

    const { db } = getAdminServices();
    const ref = await db.collection(COLLECTION).add({
      applicantName: safeText(values.applicantName, 160),
      phone: safeText(values.phone, 40),
      email: values.email ? values.email.toLowerCase() : "",
      roleAtBusiness: values.roleAtBusiness,
      contactPreference: values.contactPreference,
      businessName: safeText(values.businessName, 180),
      registrationStatus: values.registrationStatus,
      category: safeText(values.category, 100),
      country,
      city: cityName,
      notes: safeText(values.notes, 1000),
      seen: false,
      seenAt: null,
      contactedAt: null,
      status: "new",
      source: "simple_business_onboarding",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return Response.json(
      { ok: true, id: ref.id },
      { status: 201, headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(rate.remaining) } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues?.[0]?.message || "Please check your registration details.";
      return Response.json({ ok: false, error: firstIssue, details: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function GET(request) {
  try {
    requireRegistrationsPassword(request);
    const { db } = getAdminServices();
    const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(500).get();
    return Response.json(
      { ok: true, registrations: snap.docs.map(serializeRegistration) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request) {
  try {
    requireRegistrationsPassword(request);
    const body = patchSchema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection(COLLECTION).doc(body.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ ok: false, error: "Registration not found." }, { status: 404 });
    }

    const existing = snap.data() || {};
    let nextSeen = Boolean(existing.seen);
    let nextStatus = existing.status || (existing.seen ? "seen" : "new");

    if (body.status === "contacted") {
      nextStatus = "contacted";
      nextSeen = true;
    } else if (body.status === "seen") {
      nextStatus = "seen";
      nextSeen = true;
    } else if (body.status === "new") {
      nextStatus = "new";
      nextSeen = false;
    } else if (typeof body.seen === "boolean") {
      nextSeen = body.seen;
      if (!nextSeen) nextStatus = "new";
      else if (nextStatus === "new") nextStatus = "seen";
    }

    const patch = {
      seen: nextSeen,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (nextSeen && !existing.seenAt) {
      patch.seenAt = FieldValue.serverTimestamp();
    } else if (!nextSeen) {
      patch.seenAt = null;
      patch.contactedAt = null;
    }

    if (nextStatus === "contacted" && !existing.contactedAt) {
      patch.contactedAt = FieldValue.serverTimestamp();
    } else if (nextStatus !== "contacted" && existing.contactedAt) {
      patch.contactedAt = null;
    }

    await ref.update(patch);
    return Response.json({ ok: true, id: body.id, seen: nextSeen, status: nextStatus }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ ok: false, error: "Invalid update payload." }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function DELETE(request) {
  try {
    requireRegistrationsPassword(request);
    const url = new URL(request.url);
    let id = url.searchParams.get("id") || "";
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = String(body?.id || "").trim();
    }
    if (!id || id.length > 180) {
      return Response.json({ ok: false, error: "Registration ID is required." }, { status: 400 });
    }

    const { db } = getAdminServices();
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ ok: false, error: "Registration not found." }, { status: 404 });
    }

    await ref.delete();
    return Response.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
