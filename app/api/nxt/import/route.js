import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { requireNxt, noStore, audit } from "@/lib/nxt-server";
import { cleanProspect } from "@/lib/nxt-policy";

export const runtime = "nodejs";

// Source spreadsheets contain outreach contact data and must never be bundled
// into a public source repository. The NXT manager selects the private export
// in their browser and sends bounded batches through this authenticated API.
const textFields = [
  "category", "description", "city", "address", "phone", "email",
  "website", "contactName", "contactRole", "sourceNote", "priority", "nextAction"
];
const rowSchema = z.object({
  sourceId: z.string().trim().regex(/^IB-[0-9]{4,8}$/),
  name: z.string().trim().min(1).max(240),
  ...Object.fromEntries(textFields.map(key => [key, z.string().max(1500).optional()]))
});
const schema = z.object({
  action: z.literal("import"),
  offset: z.number().int().min(0).max(10000),
  total: z.number().int().min(1).max(10000),
  confirm: z.literal(true),
  rows: z.array(rowSchema).min(1).max(80)
}).strict().refine(
  value => value.offset + value.rows.length <= value.total &&
    new Set(value.rows.map(row => row.sourceId)).size === value.rows.length,
  { message: "Invalid or duplicate source IDs in the upload batch." }
);

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    requireNxt(actor, "import");
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 150000) {
      return noStore({ ok: false, error: "Upload batches must be under 150 KB." }, 413);
    }
    const body = schema.parse(await request.json());
    await enforceRateLimit(request, { key: "nxt_import", limit: 20, windowMs: 60_000, identity: actor.uid });

    const { db } = getAdminServices();
    const refs = body.rows.map(row => db.collection("nxtProspects").doc(`nxt-${row.sourceId}`));
    const existing = await db.getAll(...refs);
    const batch = db.batch();
    let inserted = 0;
    body.rows.forEach((row, index) => {
      if (existing[index]?.exists) return;
      // Import creates private research records, never published businesses or
      // approved ownership claims. Repeating a batch leaves existing rows alone.
      batch.create(refs[index], {
        ...cleanProspect(row),
        sourceId: row.sourceId,
        source: "spotly_outreach_workbook_2026_10_27",
        assigneeUid: "",
        status: "new",
        public: false,
        claimStatus: "unclaimed",
        verificationStatus: "unverified",
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      inserted++;
    });
    if (inserted) await batch.commit();
    await audit(db, actor, "nxt.workbook_import", "nxtProspects", "2026-10-27", {
      offset: body.offset, examined: body.rows.length, created: inserted
    });
    const nextOffset = body.offset + body.rows.length;
    return noStore({
      ok: true, inserted, examined: body.rows.length, nextOffset,
      hasMore: nextOffset < body.total, total: body.total
    });
  } catch (error) {
    return apiError(error);
  }
}
