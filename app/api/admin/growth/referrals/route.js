import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function actorFor(request) {
  return authenticateRequest(request, { roles: ["super_admin", "platform_admin", "marketing_manager"] });
}

function record(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    userId: data.userId || "",
    role: data.role === "referrer" ? "referrer" : "referee",
    amount: Math.max(0, Number(data.amount || 0)),
    currency: String(data.currency || "USD").toUpperCase(),
    status: data.status || "pending_review",
    orderId: data.orderId || "",
    createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
    reviewedAt: data.reviewedAt?.toDate?.().toISOString?.() || null
  };
}

export async function GET(request) {
  try {
    await actorFor(request);
    const { db } = getAdminServices();
    const snapshot = await db.collection("referralRewards").limit(250).get();
    const rewards = snapshot.docs.map(record).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return Response.json({ ok: true, rewards });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await actorFor(request);
    const body = z.object({ id: z.string().trim().min(1).max(180), action: z.enum(["approve", "reject"]) }).parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("referralRewards").doc(body.id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return Response.json({ ok: false, error: "That referral reward was not found." }, { status: 404 });
    const current = snapshot.data() || {};
    if (!["pending_review", "approved", "rejected"].includes(current.status || "pending_review")) return Response.json({ ok: false, error: "That referral reward is no longer reviewable." }, { status: 409 });
    const nextStatus = body.action === "approve" ? "approved" : "rejected";
    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (transaction) => {
      transaction.set(ref, { status: nextStatus, reviewedAt: now, reviewedBy: actor.uid, updatedAt: now }, { merge: true });
      transaction.create(db.collection("auditLogs").doc(), {
        action: `growth.referral_reward_${nextStatus}`,
        entityType: "referralReward",
        entityId: ref.id,
        actorId: actor.uid,
        actorEmail: actor.email || "",
        metadata: { userId: current.userId || "", amount: Number(current.amount || 0), currency: current.currency || "USD", role: current.role || "" },
        createdAt: now
      });
    });
    return Response.json({ ok: true, status: nextStatus });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a valid referral reward action." }, { status: 400 });
    return apiError(error);
  }
}
