import { groupMarketplaceBusinesses } from "@/lib/business-groups";
import { unclaimedPublicationEnabled } from "@/lib/directory-publication-server";
import { canShowDirectoryRecord } from "@/lib/nxt-policy";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { queryOpenPlaces, mergeCuratedWithFirestore } from "@/lib/open-marketplace-data";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable } from "@/lib/marketplace-trust";
import { compareMarketplaceBusinesses } from "@/lib/marketplace-ranking";
import { marketplaceProfile, serviceMatchesMarketplaceBusiness } from "@/lib/marketplace-taxonomy";
import { countryForCity, normalizeCountryCode } from "@/lib/country-engine";
import { resolveServiceAvailability } from "@/lib/service-availability";

export const runtime = "nodejs";

function text(value) { return String(value || "").trim().toLowerCase(); }
function tokens(value) { return text(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").split(" ").filter((item) => item.length >= 2).slice(0, 8); }
function searchable(record = {}) { return [record.name, record.brandName, record.category, ...(record.categories || []), record.city, record.area, record.suburb, record.address, ...(record.tags || []), ...(record.groupedLocations || []).flatMap(location=>[location.name,location.branchName,location.address])].filter(Boolean).join(" ").toLowerCase(); }
function visible(record = {}) { return isMarketplaceDiscoverable(record); }

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-marketplace", limit: 120, windowMs: 60_000 });
    const url = new URL(request.url);
    const queryText = url.searchParams.get("q") || "";
    const requestedCountry = normalizeCountryCode(url.searchParams.get("country"));
    const city = url.searchParams.get("city") || "";
    const service = url.searchParams.get("service") || "";
    const max = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);
    const requestedTokens = tokens(queryText);
    const country = requestedCountry || countryForCity(city)?.country?.code || "";
    if (!country) return Response.json({ ok: true, businesses: [], total: 0, requiresLocation: true }, { headers: { "Cache-Control": "private, max-age=0", "X-RateLimit-Remaining": String(rate.remaining) } });
    const { db } = getAdminServices();

    const [snapshot, curatedResult, showUnclaimed, settingsSnapshot] = await Promise.all([
      db.collection("businesses").where("public", "==", true).limit(700).get(),
      Promise.resolve(queryOpenPlaces({ country, city, q: queryText, service, limit: 2500 })),
      unclaimedPublicationEnabled(db),
      db.collection("platformSettings").doc("global").get()
    ]);
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    if (service && country) {
      const requestedDecision = resolveServiceAvailability(settings, { service, country, city });
      if (!requestedDecision.discoverable) return Response.json({ ok: true, businesses: [], total: 0, availability: requestedDecision }, { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60", "X-RateLimit-Remaining": String(rate.remaining) } });
    }
    const firestore = snapshot.docs.filter((doc) => visible(doc.data()) && canShowDirectoryRecord(doc.data(), showUnclaimed)).map((doc) => publicBusinessRecord(doc.id, doc.data()));
    const curated = (showUnclaimed ? curatedResult.records : []).map((item) => publicBusinessRecord(item.id, item));
    const records = groupMarketplaceBusinesses(mergeCuratedWithFirestore(curated, firestore))
      .filter((item) => {
        const itemCountry = normalizeCountryCode(item.country) || countryForCity(item.city)?.country?.code || "";
        return !country || itemCountry === country;
      })
      .filter((item) => !city || !text(item.city) || text(item.city) === text(city))
      .filter((item) => !service || serviceMatchesMarketplaceBusiness(service, item))
      .filter((item) => {
        const profile = marketplaceProfile(item);
        if (!profile?.service || profile.service === "directory") return !service;
        const itemCountry = normalizeCountryCode(item.country) || countryForCity(item.city)?.country?.code || country;
        return resolveServiceAvailability(settings, { service: profile.service, country: itemCountry, city: item.city || city }).discoverable;
      })
      .filter((item) => !requestedTokens.length || requestedTokens.every((token) => searchable(item).includes(token)))
      .sort((a, b) => compareMarketplaceBusinesses(a, b))
      .slice(0, max);

    return Response.json({ ok: true, businesses: records, total: records.length, dataAttribution: { openStreetMap: "© OpenStreetMap contributors", license: "ODbL-1.0", licenseUrl: "https://www.openstreetmap.org/copyright" } }, {
      headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60", "X-RateLimit-Remaining": String(rate.remaining) }
    });
  } catch (error) { return apiError(error); }
}
