import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { queryOpenPlaces, mergeCuratedWithFirestore } from "@/lib/open-marketplace-data";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable } from "@/lib/marketplace-trust";

export const runtime = "nodejs";
const text = (value) => String(value || "").trim().toLowerCase();
const tokens = (value) => text(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").split(" ").filter((item) => item.length >= 2).slice(0, 8);
const searchable = (record = {}) => [record.name, record.brandName, record.category, ...(record.categories || []), record.city, record.area, record.suburb, record.address, ...(record.tags || [])].filter(Boolean).join(" ").toLowerCase();

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-business-directory", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url); const q = url.searchParams.get("q") || ""; const city = url.searchParams.get("city") || ""; const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 300); const requested = tokens(q);
    const { db } = getAdminServices();
    const [snapshot, open] = await Promise.all([db.collection("businesses").where("public", "==", true).limit(700).get(), Promise.resolve(queryOpenPlaces({ city, q, limit: 2500 }))]);
    const firestore = snapshot.docs.filter((doc) => isMarketplaceDiscoverable(doc.data())).map((doc) => publicBusinessRecord(doc.id, doc.data()));
    const curated = open.records.map((item) => publicBusinessRecord(item.id, item));
    const businesses = mergeCuratedWithFirestore(curated, firestore).filter((item) => !city || !text(item.city) || text(item.city) === text(city)).filter((item) => !requested.length || requested.every((word) => searchable(item).includes(word))).sort((a,b)=>Number(b.commerceVerified)-Number(a.commerceVerified)||a.name.localeCompare(b.name)).slice(0, limit);
    return Response.json({ ok:true, businesses, total: businesses.length, dataAttribution:{ openStreetMap:"© OpenStreetMap contributors", license:"ODbL-1.0", licenseUrl:"https://www.openstreetmap.org/copyright" } }, { headers:{ "Cache-Control":"public, max-age=20, stale-while-revalidate=60", "X-RateLimit-Remaining":String(rate.remaining) } });
  } catch (error) { return apiError(error); }
}
