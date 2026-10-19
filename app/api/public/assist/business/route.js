import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { marketplaceTrust } from "@/lib/marketplace-trust";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { canAssistBook } from "@/lib/spotly-assist";
import { enforceRateLimit } from "@/lib/rate-limit-server";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    await enforceRateLimit(request, { key: "assist-book-business", limit: 100, windowMs: 60_000 });
    const id = String(new URL(request.url).searchParams.get("businessId") || "").slice(0, 180);
    if (!id) throw Object.assign(new Error("Choose a business."), { status: 422 });
    const { db } = getAdminServices();
    const [snap, settingsSnap] = await Promise.all([
      db.collection("businesses").doc(id).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    const record = snap.exists ? snap.data() : null;
    if (!record || !marketplaceTrust(record).discoveryAllowed || !canAssistBook(record, settingsSnap.data() || {})) {
      throw Object.assign(new Error("This business is currently available for discovery only."), { status: 404 });
    }
    const business = publicBusinessRecord(snap.id, record);
    return Response.json({ ok: true, business: { id: business.id, name: business.name,
      city: business.city, area: business.area, address: business.address,
      category: business.category, country: business.country,
      assist: { mode: "booking" }
    } }, { headers: { "Cache-Control": "public, max-age=20" } });
  } catch (error) { return apiError(error); }
}
