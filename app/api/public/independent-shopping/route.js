import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { independentPublicStore, independentShoppingFlags } from "@/lib/independent-shopping";
import { operationalAssistAvailable } from "@/lib/v9-assist-regions";
import { filterSafeIndependentStores } from "@/lib/assist-store-safety";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-independent-shopping", limit: 90, windowMs: 60_000 });
    const { db } = getAdminServices();
    const config = await db.collection("platformSettings").doc("global").get();
    if (!independentShoppingFlags(config.data()).browseEnabled) {
      return Response.json({ ok: true, enabled: false, requestEnabled: false, stores: [] });
    }
    const url = new URL(request.url);
    const city = String(url.searchParams.get("city") || "").trim().toLowerCase().slice(0, 100);
    const search = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 120);
    const storesSnap = await db.collection("independentShoppingStores").where("status", "==", "published").limit(100).get();
    const safeStores = await filterSafeIndependentStores(db, storesSnap.docs.map((snap) => ({ ...snap.data(), id: snap.id })));
    const stores = safeStores.filter((raw) => operationalAssistAvailable(config.data()?.assistCoverage || {}, raw, "eat").available).map((raw) => independentPublicStore(raw.id, raw)).filter(Boolean)
      .filter((store) => (!city || store.city.toLowerCase() === city) &&
        (!search || [store.name, store.city, store.area, store.category, ...store.items.map((i) => i.name)]
          .join(" ").toLowerCase().includes(search)))
      .slice(0, 60);
    return Response.json({
      ok: true,
      enabled: true,
      requestEnabled: independentShoppingFlags(config.data()).requestEnabled,
      stores,
      disclaimer: "Independent shopping. These stores are not affiliated with Spotly. Prices are estimates and must be reconfirmed before payment."
    }, { headers: { "X-RateLimit-Remaining": String(rate.remaining), "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
