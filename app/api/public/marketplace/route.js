import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { queryOpenPlaces, mergeCuratedWithFirestore } from "@/lib/open-marketplace-data";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable } from "@/lib/marketplace-trust";
import { assistModeForBusiness, canAssistBook } from "@/lib/spotly-assist";
import { independentPublicStore } from "@/lib/independent-shopping";

export const runtime = "nodejs";

function text(value) { return String(value || "").trim().toLowerCase(); }
function tokens(value) { return text(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").split(" ").filter((item) => item.length >= 2).slice(0, 8); }
function searchable(record = {}) { return [record.name, record.brandName, record.category, ...(record.categories || []), record.city, record.area, record.suburb, record.address, ...(record.tags || [])].filter(Boolean).join(" ").toLowerCase(); }
function visible(record = {}) { return isMarketplaceDiscoverable(record); }

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const queryText = url.searchParams.get("q") || "";
    const city = url.searchParams.get("city") || "";
    const country = String(url.searchParams.get("country") || "").trim().toUpperCase();
    const service = url.searchParams.get("service") || "";
    const max = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);
    const requestedTokens = tokens(queryText);
    const { db } = getAdminServices();

    const [snapshot, curatedResult, settingsSnap, independentSnap] = await Promise.all([
      db.collection("businesses").where("public", "==", true).limit(700).get(),
      Promise.resolve(queryOpenPlaces({ city, q: queryText, service, limit: 2500 })),
      db.collection("platformSettings").doc("global").get(),
      db.collection("independentShoppingStores").where("status", "==", "published").limit(250).get()
    ]);
    const settings = settingsSnap.data() || {};
    const independentByBusiness = new Map(independentSnap.docs.map((doc) => ({ id: doc.id, record: doc.data(), store: independentPublicStore(doc.id, doc.data()) }))
      .filter((entry) => entry.store && entry.record.directoryBusinessId && entry.record.assistEnabled !== false)
      .map((entry) => [entry.record.directoryBusinessId, entry.store]));
    const firestore = snapshot.docs.filter((doc) => visible(doc.data())).map((doc) => publicBusinessRecord(doc.id, doc.data()));
    const firestoreIds = new Set(firestore.map((business) => business.id));
    const curated = curatedResult.records.map((item) => publicBusinessRecord(item.id, item));
    const records = mergeCuratedWithFirestore(curated, firestore)
      .filter((item) => !country || String(item.country || "ZW").toUpperCase() === country)
      .filter((item) => !city || !text(item.city) || text(item.city) === text(city))
      .map((business) => {
        const mode = firestoreIds.has(business.id) ? assistModeForBusiness(business, settings) : null;
        const store = mode === "shopping" ? independentByBusiness.get(business.id) : null;
        const assist = store ? { mode: "shopping", storeId: store.id, preview: store.items.slice(0, 3).map((item) => ({name:item.name,price:item.priceEstimate,currency:item.currency})) } : mode === "booking" && canAssistBook(business, settings) ? {mode:"booking",businessId:business.id} : null;
        return { ...business, assist };
      })
      .filter((item) => !requestedTokens.length || requestedTokens.every((token) => searchable(item).includes(token)))
      .sort((a, b) => Number(b.commerceVerified) - Number(a.commerceVerified) || Number(Boolean(b.assist)) - Number(Boolean(a.assist)) || Number(b.isFeatured) - Number(a.isFeatured) || (Number(b.rating || 0) - Number(a.rating || 0)) || a.name.localeCompare(b.name))
      .slice(0, max);

    return Response.json({ ok: true, businesses: records, total: records.length, dataAttribution: { openStreetMap: "© OpenStreetMap contributors", license: "ODbL-1.0", licenseUrl: "https://www.openstreetmap.org/copyright" } }, {
      headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60", "X-RateLimit-Remaining": String(rate.remaining) }
    });
  } catch (error) { return apiError(error); }
}
