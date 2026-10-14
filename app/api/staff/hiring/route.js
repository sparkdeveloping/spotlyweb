import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireSpotlyStaffPermission } from "@/lib/access-control-server";
import { CAREER_STAGES } from "@/data/careers";
import { STAFF_DEPARTMENTS, STAFF_ROLE_PACKS } from "@/data/staff";
import { listCareerJobs, staffCareerJob } from "@/lib/careers-server";
import { effectiveSecret } from "@/lib/platform-secrets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stageSchema = z.enum(CAREER_STAGES);
const roleIds = Object.keys(STAFF_ROLE_PACKS);
const jobSchema = z.object({
  action: z.literal("save_job"),
  id: z.string().regex(/^[a-z0-9-]{3,120}$/).optional(),
  title: z.string().min(3).max(160),
  department: z.enum(STAFF_DEPARTMENTS),
  location: z.string().min(2).max(160),
  arrangement: z.string().min(2).max(120),
  employmentType: z.enum(["Full-time", "Part-time", "Contract", "Internship", "Temporary"]),
  rolePackId: z.union([z.enum(roleIds), z.literal("")]).optional().default(""),
  summary: z.string().min(20).max(500),
  description: z.string().min(40).max(3000),
  responsibilities: z.array(z.string().min(3).max(500)).max(16),
  requirements: z.array(z.string().min(3).max(500)).max(16),
  niceToHave: z.array(z.string().min(3).max(500)).max(12).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "paused", "closed"]).default("published")
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("job_status"), jobId: z.string().min(3).max(120), status: z.enum(["draft", "published", "paused", "closed"]) }),
  z.object({ action: z.literal("candidate_stage"), applicationId: z.string().min(3).max(180), stage: stageSchema, note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("candidate_note"), applicationId: z.string().min(3).max(180), note: z.string().min(2).max(1800) }),
  z.object({ action: z.literal("candidate_message"), applicationId: z.string().min(3).max(180), subject: z.string().min(3).max(160), message: z.string().min(10).max(5000) }),
  z.object({ action: z.literal("schedule_interview"), applicationId: z.string().min(3).max(180), scheduledFor: z.string().min(5).max(80), format: z.enum(["phone", "video", "in_person"]), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("cv_link"), applicationId: z.string().min(3).max(180) }),
  z.object({ action: z.literal("create_candidate"), jobId: z.string().min(3).max(120), fullName: z.string().min(2).max(160), email: z.string().email().max(254), phone: z.string().max(50).optional().default(""), city: z.string().max(120).optional().default(""), note: z.string().max(1800).optional().default("") })
]);

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}
function iso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function applicationView(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    jobId: data.jobId || "",
    job: data.jobSnapshot || { id: data.jobId || "", title: "Spotly position", department: "" },
    fullName: data.fullName || "",
    email: data.email || "",
    phone: data.phone || "",
    city: data.city || "",
    currentRole: data.currentRole || "",
    noticePeriod: data.noticePeriod || "",
    linkedIn: data.linkedIn || "",
    portfolio: data.portfolio || "",
    whySpotly: data.whySpotly || "",
    experience: data.experience || "",
    stage: data.stage || "new",
    status: data.status || "active",
    source: data.source || "careers",
    cvAvailable: Boolean(data.cv?.path),
    cvFileName: data.cv?.fileName || "CV",
    notes: Array.isArray(data.notes) ? data.notes : [],
    interview: data.interview || null,
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    communications: Array.isArray(data.communications) ? data.communications : [],
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt)
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

async function sendCandidateEmail(db, candidate, body, user) {
  const apiKey = await effectiveSecret("resend", "apiKey", ["RESEND_API_KEY"]);
  const from = (await effectiveSecret("resend", "fromEmail", ["RESEND_FROM_EMAIL"])) || "Spotly Careers <onboarding@resend.dev>";
  if (!apiKey) throw Object.assign(new Error("Candidate email delivery is not configured yet."), { status: 503 });
  const htmlMessage = escapeHtml(body.message).replace(/\n/g, "<br/>");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#16161d"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e9e9ef;border-radius:22px;padding:32px"><div style="font-size:22px;font-weight:800;color:#111">Spotly Careers</div><p style="font-size:16px;line-height:1.7;margin:28px 0 0">${htmlMessage}</p><p style="font-size:12px;line-height:1.6;color:#858692;margin:30px 0 0">This recruitment message was sent by Spotly People Operations about ${escapeHtml(candidate.jobSnapshot?.title || "a Spotly opportunity")}.</p></div></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [candidate.email], subject: body.subject, html }) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result?.message || "The email provider rejected the candidate message."), { status: 502 });
  await db.collection("emailLogs").add({ provider: "resend", providerId: result.id || "", type: "career_candidate_message", to: String(candidate.email || "").toLowerCase(), subject: body.subject, requestedBy: user.uid, status: "sent", createdAt: FieldValue.serverTimestamp() });
  return result.id || "";
}

async function requireRecruitment(db, user, permission = "recruitment.read") {
  return requireSpotlyStaffPermission(db, user, permission, { roles: ["people_operations_admin", "operations_manager", "platform_admin"] });
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    await requireRecruitment(db, user, "recruitment.read");
    const [jobs, apps] = await Promise.all([
      listCareerJobs(db, { includeUnpublished: true }),
      db.collection("careerApplications").orderBy("createdAt", "desc").limit(250).get()
    ]);
    return Response.json({ ok: true, jobs: jobs.map(staffCareerJob), applications: apps.docs.map(applicationView) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const { db, storage } = getAdminServices();
    const payload = await request.json();
    const now = new Date().toISOString();

    if (payload.action === "save_job") {
      await requireRecruitment(db, user, "recruitment.manage");
      const body = jobSchema.parse(payload);
      const id = body.id || `${slugify(body.title)}-${crypto.randomBytes(3).toString("hex")}`;
      const { action, ...job } = body;
      const ref = db.collection("careerJobs").doc(id);
      const existing = await ref.get();
      await ref.set({ ...job, ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }), updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
      return Response.json({ ok: true, id });
    }

    const body = actionSchema.parse(payload);
    if (body.action === "job_status") {
      await requireRecruitment(db, user, "recruitment.manage");
      await db.collection("careerJobs").doc(body.jobId).set({ status: body.status, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }, { merge: true });
      return Response.json({ ok: true });
    }

    if (body.action === "cv_link") {
      await requireRecruitment(db, user, "recruitment.read");
      const snapshot = await db.collection("careerApplications").doc(body.applicationId).get();
      if (!snapshot.exists || !snapshot.data()?.cv?.path) throw Object.assign(new Error("This application does not have a CV attachment."), { status: 404 });
      const [url] = await storage.bucket().file(snapshot.data().cv.path).getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000 });
      return Response.json({ ok: true, url, fileName: snapshot.data().cv.fileName || "CV" });
    }

    if (body.action === "create_candidate") {
      await requireRecruitment(db, user, "recruitment.manage");
      const jobs = await listCareerJobs(db, { includeUnpublished: true });
      const job = jobs.find((item) => item.id === body.jobId);
      if (!job) throw Object.assign(new Error("Choose a valid Spotly role."), { status: 404 });
      const ref = db.collection("careerApplications").doc();
      await ref.set({
        jobId: job.id,
        jobSnapshot: { id: job.id, title: job.title, department: job.department, location: job.location, employmentType: job.employmentType },
        fullName: body.fullName,
        email: body.email,
        emailNormalized: body.email.toLowerCase(),
        phone: body.phone,
        city: body.city,
        stage: "screening",
        status: "active",
        source: "staff_sourced",
        notes: body.note ? [{ note: body.note, at: now, by: user.uid }] : [],
        timeline: [{ stage: "screening", label: "Added to hiring pipeline", at: now, actor: user.uid }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: user.uid
      });
      return Response.json({ ok: true, applicationId: ref.id });
    }

    await requireRecruitment(db, user, body.action === "candidate_note" ? "recruitment.read" : "recruitment.manage");
    const ref = db.collection("careerApplications").doc(body.applicationId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("This candidate could not be found."), { status: 404 });

    if (body.action === "candidate_note") {
      await ref.update({ notes: FieldValue.arrayUnion({ note: body.note, at: now, by: user.uid }), updatedAt: FieldValue.serverTimestamp() });
    } else if (body.action === "candidate_message") {
      const providerId = await sendCandidateEmail(db, snapshot.data(), body, user);
      await ref.update({
        communications: FieldValue.arrayUnion({ channel: "email", subject: body.subject, message: body.message, at: now, by: user.uid, providerId }),
        timeline: FieldValue.arrayUnion({ stage: snapshot.data().stage || "new", label: "Candidate email sent", at: now, actor: user.uid }),
        updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid
      });
    } else if (body.action === "candidate_stage") {
      await ref.update({
        stage: body.stage,
        status: ["rejected", "withdrawn"].includes(body.stage) ? "closed" : body.stage === "hired" ? "hired" : "active",
        notes: body.note ? FieldValue.arrayUnion({ note: body.note, at: now, by: user.uid }) : (snapshot.data().notes || []),
        timeline: FieldValue.arrayUnion({ stage: body.stage, label: `Moved to ${body.stage.replaceAll("_", " ")}`, at: now, actor: user.uid }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
    } else if (body.action === "schedule_interview") {
      await ref.update({
        stage: "interview",
        interview: { scheduledFor: body.scheduledFor, format: body.format, note: body.note || "", scheduledBy: user.uid, scheduledAt: now },
        timeline: FieldValue.arrayUnion({ stage: "interview", label: "Interview scheduled", at: now, actor: user.uid }),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error?.issues) return Response.json({ ok: false, error: error.issues[0]?.message || "Check the hiring details and try again." }, { status: 400 });
    return apiError(error);
  }
}
