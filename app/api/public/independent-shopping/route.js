import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { independentPublicStore, independentShoppingFlags } from "@/lib/independent-shopping";
import { operationalAssistAvailable } from "@/lib/v9-assist-regions";
import { filterSafeIndependentStores } from "@/lib/assist-store-safety";
import { directoryShoppingStore } from "@/lib/directory-shopping-server";
import { catalogueService } from "@/lib/spotly-catalogue";
import { resolveServiceAvailability } from "@/lib/service-availability";
import { countryForCity, normalizeCountryCode } from "@/lib/country-engine";

export const runtime = "nodejs";

function availabilityFor(settings, store) {
  const country = normalizeCountryCode(store?.country) || countryForCity(store?.city)?.country?.code || "";
  return resolveServiceAvailability(settings || {}, { service: catalogueService(store), country, city: store?.city || "" });
}

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
    const businessId = url.searchParams.get("business") || "";
    const storeId = url.searchParams.get("store") || "";
    const branchId = url.searchParams.get("branch") || "";
    if (businessId || storeId.startsWith("directory_")) {
      const found = await directoryShoppingStore(db, { businessId, branchId, storeId, settings: config.data() || {} });
      const availability = found?.store ? availabilityFor(config.data() || {}, found.store) : null;
      return Response.json({ ok: true, enabled: Boolean(found?.store && availability?.discoverable), requestEnabled: Boolean(found?.store && availability?.transactable && independentShoppingFlags(config.data()).requestEnabled),
        stores: found?.store && availability?.discoverable ? [{...found.store,serviceAvailability:availability}] : [], message: found?.store && !availability?.discoverable ? "This service is not available for discovery here." : found?.store ? "" : "This location is not accepting assisted shopping requests." }, { headers: { "Cache-Control": "no-store" } });
    }
    if (storeId) {
      if (!/^[a-zA-Z0-9_-]{3,360}$/.test(storeId)) return Response.json({ok:false,error:"Choose a valid location."},{status:422});
      const doc = await db.collection("independentShoppingStores").doc(storeId).get();
      const safe = doc.exists ? await filterSafeIndependentStores(db,[{...doc.data(),id:doc.id}]) : [];
      const stores = safe.filter(raw => operationalAssistAvailable(config.data()?.assistCoverage || {},raw,catalogueService(raw)).available).map(raw=>{const store=independentPublicStore(raw.id,raw);const availability=store?availabilityFor(config.data()||{},store):null;return store&&availability?.discoverable?{...store,serviceAvailability:availability}:null;}).filter(Boolean);
      return Response.json({ok:true,enabled:stores.length>0,requestEnabled:stores.some(store=>store.serviceAvailability?.transactable)&&independentShoppingFlags(config.data()).requestEnabled,stores},{headers:{"Cache-Control":"no-store"}});
    }
    const city = String(url.searchParams.get("city") || "").trim().toLowerCase().slice(0, 100);
    const search = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 120);
    const storesSnap = await db.collection("independentShoppingStores").where("status", "==", "published").limit(100).get();
    const safeStores = await filterSafeIndependentStores(db, storesSnap.docs.map((snap) => ({ ...snap.data(), id: snap.id })));
    const stores = safeStores.filter((raw) => operationalAssistAvailable(config.data()?.assistCoverage || {}, raw, catalogueService(raw)).available).map((raw) => { const store=independentPublicStore(raw.id, raw); const availability=store?availabilityFor(config.data()||{},store):null; return store&&availability?.discoverable?{...store,serviceAvailability:availability}:null; }).filter(Boolean)
      .filter((store) => (!city || store.city.toLowerCase() === city) &&
        (!search || [store.name, store.city, store.area, store.category, ...store.items.map((i) => i.name)]
          .join(" ").toLowerCase().includes(search)))
      .slice(0, 60);
    return Response.json({
      ok: true,
      enabled: true,
      requestEnabled: stores.some((store)=>store.serviceAvailability?.transactable) && independentShoppingFlags(config.data()).requestEnabled,
      stores,
      disclaimer: "Independent shopping. These stores are not affiliated with Spotly. Prices are estimates and must be reconfirmed before payment."
    }, { headers: { "X-RateLimit-Remaining": String(rate.remaining), "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
