import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { canTransitionAssist } from "@/lib/spotly-assist";

export const runtime = "nodejs";
const schema = z.object({ id: z.string().min(3).max(210), decision: z.enum(["accept_alternative","decline_alternative","cancel"]) }).strict();
export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const { id, decision } = schema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("assistedBookings").doc(id);
    let nextState = "";
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().customerId !== user.uid) throw Object.assign(new Error("Booking not found."), { status: 404 });
      const booking = snap.data();
      if (decision.includes("alternative") && (booking.state !== "awaiting_customer" || !booking.proposedDate || !booking.proposedTime)) {
        throw Object.assign(new Error("This booking does not have an open alternative for you to review."), { status: 409 });
      }
      if (decision === "cancel") nextState = "cancelled";
      else if (decision === "accept_alternative") nextState = "awaiting_confirmation";
      else nextState = "contacting_business";
      if (!canTransitionAssist(booking.state, nextState)) throw Object.assign(new Error("This request can no longer be updated."), { status: 409 });
      tx.set(ref, {
        state: nextState,
        customerDecision: decision,
        customerAcceptedAt: decision === "accept_alternative" ? FieldValue.serverTimestamp() : null,
        customerMessage: decision === "accept_alternative" ? "You accepted the alternative. Spotly will confirm it with the business." :
          decision === "decline_alternative" ? "You declined that time. Spotly can ask the business about other availability." : "You cancelled this request.",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      tx.create(db.collection("assistEvents").doc(), {
        entityId: ref.id, kind: "booking", actorId: user.uid, actorType: "customer",
        action: decision, previousState: booking.state, nextState, createdAt: FieldValue.serverTimestamp()
      });
    });
    return Response.json({ ok: true, state: nextState, confirmed: false });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose how to respond to this appointment." }, { status: 422 });
    return apiError(error);
  }
}
