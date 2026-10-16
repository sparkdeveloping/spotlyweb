import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function directoryVisible(record = {}) {
  return record.public === true && text(record.status) !== "archived" && !record.canonicalBusinessId;
}

function publicBranch(doc) {
  const item = doc.data() || {};
  return {
    id: doc.id,
    businessId: item.businessId,
    branchName: item.branchName || item.name || item.displayName || "Location",
    name: item.name || item.branchName || item.displayName || "Location",
    displayName: item.displayName || item.branchName || item.name || "Location",
    city: item.city || "",
    suburb: item.suburb || item.area || "",
    address: item.address || "",
    phone: item.phone || item.contactPhone || "",
    status: item.status || "active",
    public: item.public === true
  };
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    const rate = await enforceRateLimit(request, { key: "public-business-directory-detail", limit: 180, windowMs: 60_000 });
    const url = new URL(request.url);
    const businessId = String(url.searchParams.get("businessId") || "").trim();
    if (!businessId || businessId.length > 180 || businessId.includes("/")) throw Object.assign(new Error("Choose a valid business first."), { status: 422 });

    const { db } = getAdminServices();
    const businessSnapshot = await db.collection("businesses").doc(businessId).get();
    if (!businessSnapshot.exists || !directoryVisible(businessSnapshot.data())) throw Object.assign(new Error("That business listing is not publicly available."), { status: 404 });

    const branchesSnapshot = await db.collection("branches").where("businessId", "==", businessId).limit(250).get();
    const branches = branchesSnapshot.docs
      .filter((doc) => doc.data()?.public === true && !["archived", "removed"].includes(text(doc.data()?.status)))
      .map(publicBranch)
      .sort((a, b) => String(a.branchName).localeCompare(String(b.branchName), "en", { sensitivity: "base" }));

    return Response.json({ ok: true, businessId, branches }, {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
