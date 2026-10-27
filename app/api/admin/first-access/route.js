import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { FIRST_ACCESS_STATUSES } from "@/lib/first-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const changeSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{40}$/),
  status: z.enum(FIRST_ACCESS_STATUSES).optional(),
  pipelineNote: z.string().trim().max(1500).optional(),
  assignee: z.string().trim().max(120).optional()
}).strict();
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
function timestamp(value) { return value?.toDate?.()?.toISOString?.() || null; }
function lead(doc) { const d = doc.data(); return { id: doc.id, ...d, createdAt: timestamp(d.createdAt), updatedAt: timestamp(d.updatedAt) }; }
function aggregateMetrics(docs, key) {
  const grouped = new Map();
  const accumulate = (to, from) => { for (const [field, value] of Object.entries(from || {})) {
    if (typeof value === "number") to[field] = (to[field] || 0) + value;
    else if (value && typeof value === "object" && !Array.isArray(value) && typeof value.toDate !== "function") { to[field] ||= {}; accumulate(to[field], value); }
  } };
  for (const doc of docs) {
    const data = doc.data(); const id = data[key] || "";
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, { [key]: id });
    const target = grouped.get(id);
    for (const field of ["views", "starts", "registrations", "channels", "byEvent", "interests", "cities", "timeframes", "audiences"]) {
      if (data[field] != null) accumulate(target, { [field]: data[field] });
    }
  }
  return [...grouped.values()];
}
function line(value) { const raw = String(value ?? "").replace(/"/g, '""'); return `"${/^[=+\-@\t\r]/.test(raw) ? "'" : ""}${raw}"`; }
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "launch.read");
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const days = Math.min(90, Math.max(7, Number.parseInt(url.searchParams.get("days") || "30", 10) || 30));
    const cursor = url.searchParams.get("cursor") || "";
    const exportCsv = url.searchParams.get("export") === "csv";
    const pageSize = exportCsv ? 500 : Math.min(150, Math.max(20, Number(url.searchParams.get("pageSize") || 80) || 80));
    if (exportCsv) requirePlatformPermission(actor, "launch.export");
    let query = db.collection("waitlistEntries").orderBy("createdAt", "desc").limit(pageSize);
    if (cursor) {
      const cursorDoc = await db.collection("waitlistEntries").doc(cursor).get();
      if (!cursorDoc.exists || !cursorDoc.data()?.createdAt) return Response.json({ error: "Invalid pagination cursor." }, { status: 400 });
      query = query.startAfter(cursorDoc);
    }
    const snapshot = await query.get();
    const entries = snapshot.docs.map(lead);
    // Read the authoritative current beta flag, even if it was changed in Team & Access.
    const linked = [...new Set(entries.map((e) => e.accountUid).filter(Boolean))];
    if (!exportCsv && linked.length) {
      const users = await db.getAll(...linked.map((uid) => db.collection("users").doc(uid)));
      const betaById = new Map(users.filter((u) => u.exists).map((u) => [u.id, u.data()]));
      for (const entry of entries) {
        const account = betaById.get(entry.accountUid);
        if (account && account.email?.toLowerCase() === entry.email?.toLowerCase()) entry.betaEnabled = account.privateBeta === true;
      }
    }
    const nextCursor = snapshot.size === pageSize ? snapshot.docs.at(-1)?.id || null : null;
    if (exportCsv) {
      const fields = ["createdAt", "name", "email", "phone", "city", "area", "audience", "interests", "priorityInterest", "timeframe", "status", "assignee", "pipelineNote", "channel", "campaign", "source", "accountCreated", "accountUid", "marketingOptIn"];
      const csv = [fields.map(line).join(","), ...entries.map((row) => fields.map((key) => line(Array.isArray(row[key]) ? row[key].join(" | ") : row[key])).join(","))].join("\r\n");
      return new Response(`\ufeff${csv}`, { headers: { ...noCache, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=spotly-first-access.csv", "X-Next-Cursor": nextCursor || "" } });
    }
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const [metricsSnapshot, campaignsSnapshot] = await Promise.all([
      db.collection("firstAccessMetrics").where("date", ">=", start).where("date", "<=", today).orderBy("date").get(),
      db.collection("firstAccessCampaignMetrics").where("day", ">=", start).where("day", "<=", today).orderBy("day").limit(5000).get()
    ]);
    return Response.json({ ok: true, entries, nextCursor, pageSize, days, metrics: aggregateMetrics(metricsSnapshot.docs, "date"), campaigns: aggregateMetrics(campaignsSnapshot.docs, "campaign"), campaignMetricsTruncated: campaignsSnapshot.size >= 5000,
      description: "Charts summarize recorded first-party launch events since tracking was enabled. Lead list is paginated; its filters apply to the loaded page." }, { headers: noCache });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "launch.manage");
    const body = changeSchema.parse(await request.json());
    if (!["status", "pipelineNote", "assignee"].some((key) => Object.hasOwn(body, key))) return Response.json({ ok: false, error: "No changes supplied." }, { status: 400 });
    const { db } = getAdminServices();
    const ref = db.collection("waitlistEntries").doc(body.id);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (!existing.exists) throw Object.assign(new Error("Registration not found."), { status: 404 });
      const patch = Object.fromEntries(Object.entries(body).filter(([k]) => k !== "id"));
      tx.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid });
      tx.create(db.collection("auditLogs").doc(), { action: "first_access.lead_updated", entityType: "waitlistEntry", entityId: body.id,
        actorId: actor.uid, actorEmail: actor.email || "", metadata: { changedFields: Object.keys(patch), previousStatus: existing.data()?.status || "new", nextStatus: patch.status || existing.data()?.status || "new" }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true }, { headers: noCache });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid lead update." }, { status: 400 });
    return apiError(error);
  }
}
