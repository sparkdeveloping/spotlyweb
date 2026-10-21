import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";
const ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "driver_operations_coordinator"];
const schema = z.object({
  testerEmails: z.array(z.string().trim().email().max(254)).max(30)
}).strict();

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ROLES });
    const { db } = getAdminServices();
    const [config, sample, trips] = await Promise.all([
      db.collection("mobilityRideLab").doc("access").get(),
      db.collection("mobilityRideLabLocations").orderBy("updatedAt", "desc").limit(30).get(),
      db.collection("mobilityRideLabTrips").orderBy("updatedAt", "desc").limit(20).get()
    ]);
    return Response.json({ ok: true, testerEmails: config.data()?.testerEmails || [],
      recentTrips: trips.docs.map((doc) => ({ id: doc.id, state: doc.data().state, simulation: true,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null })),
      recentPositions: sample.docs.map((doc) => ({ id: doc.id, country: doc.data().country,
        lat: doc.data().location?.lat, lng: doc.data().location?.lng,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: ROLES });
    const input = schema.parse(await request.json());
    const testerEmails = [...new Set(input.testerEmails.map((email) => email.trim().toLowerCase()))].sort();
    const { db } = getAdminServices();
    const batch = db.batch();
    batch.set(db.collection("mobilityRideLab").doc("access"), {
      testerEmails, updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.create(db.collection("auditLogs").doc(), {
      actorId: actor.uid, action: "mobility_ride_lab.testers_updated",
      entityType: "mobilityRideLab", entityId: "access", source: "admin_mobility",
      metadata: { count: testerEmails.length }, createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
    return Response.json({ ok: true, testerEmails });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Enter valid tester email addresses (30 maximum)." }, { status: 400 });
    return apiError(error);
  }
}