import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { rankRestaurantCandidates } from "@/lib/assist-research-match";
export const runtime = "nodejs";
const roles = ["super_admin", "platform_admin", "operations_manager", "data_import_manager"];
const LIMIT_PER_CITY = 120;
function cleanCandidate(doc, type) {
  const raw = doc.data();
  return {
    id: doc.id, type,
    businessId: type === "branch" ? String(raw.businessId || "") : doc.id,
    name: String(raw.name || raw.displayName || raw.branchName || ""),
    brandName: String(raw.brandName || ""),
    city: String(raw.city || ""),
    area: String(raw.area || ""),
    address: String(raw.address || ""),
    phone: String(raw.phone || ""),
    claimStatus: String(raw.claimStatus || "unknown"),
    verificationStatus: String(raw.verificationStatus || "unknown")
  };
}
export async function GET(request) {
  try {
    await authenticateRequest(request, { roles });
    const url = new URL(request.url);
    const batchId = String(url.searchParams.get("batchId") || "");
    if (!/^zw_[a-f0-9]{24}$/.test(batchId)) {
      return Response.json({ ok: false, error: "Select a valid staged Zimbabwe research batch." }, { status: 422 });
    }
    const { db } = getAdminServices();
    const ref = db.collection("assistResearchBatches").doc(batchId);
    const batch = await ref.get();
    if (!batch.exists || batch.data()?.country !== "ZW") {
      return Response.json({ ok: false, error: "Research batch not found." }, { status: 404 });
    }
    const staging = await ref.collection("locations").limit(121).get();
    if (staging.size > 120) return Response.json({ ok: false, error: "Research batch is too large for this review." }, { status: 409 });
    const research = staging.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const cities = [...new Set(research.map(x => String(x.city || "").trim()).filter(Boolean))];
    // Exact-city queries avoid collection-wide reads. This is deliberately
    // a bounded candidate search, never final ownership or publication clearance.
    if (cities.length > 20) return Response.json({ ok: false, error: "Review this batch in smaller geographic groups." }, { status: 409 });
    const cityReads = await Promise.all(cities.flatMap(city => [
      db.collection("businesses").where("city", "==", city).limit(LIMIT_PER_CITY).get(),
      db.collection("branches").where("city", "==", city).limit(LIMIT_PER_CITY).get()
    ]));
    const likelyIncomplete = cityReads.some(snapshot => snapshot.size === LIMIT_PER_CITY);
    const candidates = cityReads.flatMap((snapshot, index) => snapshot.docs.map(doc =>
      cleanCandidate(doc, index % 2 === 0 ? "business" : "branch")
    )).filter(item => item.name);
    const results = research.map(item => ({
      id: item.id,
      name: item.name,
      brandName: item.brandName || item.name,
      city: item.city, area: item.area, address: item.address,
      sourceUrl: item.sourceUrl,
      observedAt: item.observedAt,
      existingCandidates: rankRestaurantCandidates(item, candidates).map(({candidate,match})=>({
        id: candidate.id, type: candidate.type, businessId: candidate.businessId,
        name: candidate.name, city: candidate.city, address: candidate.address,
        rank: match.rank, reasons: match.reasons,
        claimStatus: candidate.claimStatus, verificationStatus: candidate.verificationStatus
      })),
      duplicateStatus: "requires_human_review"
    }));
    const candidateCount = results.filter(item => item.existingCandidates.length > 0).length;
    const strongCount = results.filter(item => item.existingCandidates.some(m => m.rank === "high")).length;
    return Response.json({
      ok: true, batchId, country: "ZW", status: "read_only_reconciliation",
      researchCount: results.length, possibleMatches: candidateCount,
      strongMatches: strongCount, citiesChecked: cities,
      mayMissMatches: true, scanIncomplete: likelyIncomplete,
      warning: likelyIncomplete
        ? "At least one city has more records than this bounded review read. Do not interpret missing matches as clearance."
        : "This is a city-indexed candidate search, not a complete duplicate or ownership audit. Review all businesses and branches before publication.",
      eligibleForPublication: false, priceVerified: false, results
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
