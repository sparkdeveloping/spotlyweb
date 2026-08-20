import { FieldValue } from "firebase-admin/firestore";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, normalizePaynowStatus } from "@/lib/paynow-server";
import { applyProviderPaymentUpdate } from "@/lib/payment-processor-server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const raw = await request.text();
    const currencyHint = new URL(request.url).searchParams.get("currency") === "ZWG" ? "ZWG" : "USD";
    const paynow = await createPaynow(currencyHint);
    // Paynow's SDK validates the callback hash before returning a StatusResponse.
    const parsed = paynow.parseStatusUpdate(raw);
    const normalized = normalizePaynowStatus(parsed);
    if (!normalized.reference) throw Object.assign(new Error("The Paynow result did not include a merchant reference."), { status: 400 });

    const { db, messaging, auth } = getAdminServices();
    const result = await applyProviderPaymentUpdate(db, normalized.reference, normalized, { source: "paynow_webhook", messaging, auth });

    // Paynow recommends polling the transaction URL to confirm important status updates.
    // The signed callback is recorded first so a temporary poll failure cannot lose the provider event.
    if (normalized.pollUrl) {
      try {
        const polled = normalizePaynowStatus(await paynow.pollTransaction(normalized.pollUrl));
        polled.reference = polled.reference || normalized.reference;
        await applyProviderPaymentUpdate(db, normalized.reference, polled, { source: "paynow_webhook_poll_confirmation", messaging, auth });
      } catch (pollError) {
        await db.collection("paymentReconciliationIssues").add({
          paymentIntentReference: normalized.reference,
          type: "provider_confirmation_unavailable",
          providerStatus: normalized.providerStatus || "unknown",
          providerReference: normalized.providerReference || "",
          status: "open",
          detail: String(pollError?.message || "Paynow status confirmation failed").slice(0, 300),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }).catch(() => null);
      }
    }

    return new Response(result.deduplicated ? "OK duplicate" : "OK", { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
