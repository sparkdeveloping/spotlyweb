import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { getCareerJob, publicCareerJob } from "@/lib/careers-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  jobId: z.string().min(2).max(120),
  fullName: z.string().min(2).max(160),
  email: z.string().email().max(254),
  phone: z.string().min(5).max(50),
  city: z.string().min(2).max(120),
  currentRole: z.string().max(180).optional().default(""),
  noticePeriod: z.string().max(120).optional().default(""),
  linkedIn: z.string().max(500).optional().default(""),
  portfolio: z.string().max(500).optional().default(""),
  whySpotly: z.string().min(40).max(3000),
  experience: z.string().min(40).max(4000),
  workAuthorization: z.literal("yes"),
  consent: z.literal("yes"),
  website: z.string().max(0).optional().default("")
});

const allowedCvTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function clean(value) {
  return String(value ?? "").trim();
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requestIp(request) {
  return (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
}

function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "spotlyafrica.com" || host.endsWith(".spotlyafrica.com") || host === "localhost" || host.endsWith(".vercel.app") || host.endsWith(".vercel.run");
  } catch {
    return false;
  }
}

async function takeRateSlot(db, request) {
  const key = `${requestIp(request)}|${new Date().toISOString().slice(0, 10)}`;
  const ref = db.collection("careerApplicationRateLimits").doc(hash(key).slice(0, 48));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= 8) throw Object.assign(new Error("Too many applications were submitted from this connection today. Try again tomorrow or contact Spotly Careers."), { status: 429 });
    transaction.set(ref, { count: count + 1, day: new Date().toISOString().slice(0, 10), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

function publicStatus(data, id) {
  return {
    id,
    job: data.jobSnapshot || { id: data.jobId, title: "Spotly position" },
    stage: data.stage || "new",
    status: data.status || "active",
    submittedAt: data.createdAt?.toDate?.()?.toISOString?.() || data.submittedAt || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
    nextStep: data.stage === "new" ? "Your application is in the queue for review." : data.stage === "screening" ? "The Spotly team is reviewing your application in more detail." : data.stage === "interview" ? "Your application is in the interview stage. Check the contact details you provided for scheduling updates." : data.stage === "reference_check" ? "Spotly is completing final checks before an offer decision." : data.stage === "offer" ? "Your application is at the offer stage. Spotly People Operations will contact you directly." : data.stage === "hired" ? "Your application is complete. People Operations will continue with onboarding." : data.stage === "rejected" ? "This application is no longer moving forward." : data.stage === "withdrawn" ? "You withdrew this application." : "Spotly will contact you when there is an update."
  };
}

export async function GET(request) {
  try {
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const id = clean(url.searchParams.get("id"));
    const token = clean(url.searchParams.get("token"));
    if (!id || !token) throw Object.assign(new Error("Application reference and tracking token are required."), { status: 400 });
    const snapshot = await db.collection("careerApplications").doc(id).get();
    if (!snapshot.exists || snapshot.data()?.trackingTokenHash !== hash(token)) throw Object.assign(new Error("Application tracking link is invalid or expired."), { status: 404 });
    return Response.json({ ok: true, application: publicStatus(snapshot.data(), snapshot.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    if (!allowedOrigin(request)) throw Object.assign(new Error("This application request came from an unsupported origin."), { status: 403 });
    const { db, storage } = getAdminServices();
    await takeRateSlot(db, request);
    const form = await request.formData();
    const parsed = schema.parse(Object.fromEntries([...form.entries()].filter(([key]) => key !== "cv").map(([key, value]) => [key, clean(value)])));
    const job = await getCareerJob(db, parsed.jobId);
    if (!job) throw Object.assign(new Error("This position is no longer accepting applications."), { status: 404 });

    const emailNormalized = parsed.email.toLowerCase();
    const applicantKey = hash(`${job.id}|${emailNormalized}`);
    const duplicate = await db.collection("careerApplications").where("applicantKey", "==", applicantKey).limit(1).get();
    if (!duplicate.empty && !["rejected", "withdrawn"].includes(duplicate.docs[0].data()?.stage)) {
      throw Object.assign(new Error("An application for this position already exists for this email address."), { status: 409 });
    }

    const applicationRef = db.collection("careerApplications").doc();
    const trackingToken = crypto.randomBytes(24).toString("hex");
    const cv = form.get("cv");
    let cvRecord = null;
    if (cv && typeof cv.arrayBuffer === "function" && Number(cv.size || 0) > 0) {
      if (Number(cv.size) > 5 * 1024 * 1024) throw Object.assign(new Error("Your CV must be 5 MB or smaller."), { status: 413 });
      if (!allowedCvTypes.has(cv.type)) throw Object.assign(new Error("Upload your CV as a PDF, DOC, or DOCX file."), { status: 400 });
      const extension = cv.type === "application/pdf" ? "pdf" : cv.type === "application/msword" ? "doc" : "docx";
      const path = `career-applications/${applicationRef.id}/cv.${extension}`;
      const file = storage.bucket().file(path);
      await file.save(Buffer.from(await cv.arrayBuffer()), { resumable: false, metadata: { contentType: cv.type, cacheControl: "private, no-store", metadata: { applicationId: applicationRef.id } } });
      cvRecord = { path, fileName: clean(cv.name).slice(0, 180) || `cv.${extension}`, contentType: cv.type, size: Number(cv.size) };
    }

    const now = new Date().toISOString();
    await applicationRef.set({
      jobId: job.id,
      jobSnapshot: { id: job.id, title: job.title, department: job.department, location: job.location, employmentType: job.employmentType },
      fullName: parsed.fullName,
      email: parsed.email,
      emailNormalized,
      phone: parsed.phone,
      city: parsed.city,
      currentRole: parsed.currentRole,
      noticePeriod: parsed.noticePeriod,
      linkedIn: parsed.linkedIn,
      portfolio: parsed.portfolio,
      whySpotly: parsed.whySpotly,
      experience: parsed.experience,
      workAuthorization: true,
      consent: true,
      cv: cvRecord,
      applicantKey,
      stage: "new",
      status: "active",
      source: "careers",
      trackingTokenHash: hash(trackingToken),
      timeline: [{ stage: "new", label: "Application received", at: now, actor: "applicant" }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return Response.json({ ok: true, applicationId: applicationRef.id, trackingToken, job: publicCareerJob(job) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error?.issues) return Response.json({ ok: false, error: error.issues[0]?.message || "Check the application form and try again." }, { status: 400 });
    return apiError(error);
  }
}
