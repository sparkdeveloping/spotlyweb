import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, normalizePaynowStatus } from "@/lib/paynow-server";
import { applyProviderPaymentUpdate } from "@/lib/payment-processor-server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const raw = await request.text();
    const currencyHint = new URL(request.url).searchParams.get("currency") === "ZWG" ? "ZWG" : "USD";
    const paynow = await createPaynow(currencyHint);
    const parsed = paynow.parseStatusUpdate(raw);
    const normalized = normalizePaynowStatus(parsed);
    if (!normalized.reference) throw Object.assign(new Error("The Paynow result did not include a merchant reference."), { status: 400 });

    const { db } = getAdminServices();
    const result = await applyProviderPaymentUpdate(db, normalized.reference, normalized, { source: "paynow_webhook" });
    // Provider callbacks are acknowledged after being durably recorded. Reconciliation issues remain visible to Spotly operations.
    return new Response(result.deduplicated ? "OK duplicate" : "OK", { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
