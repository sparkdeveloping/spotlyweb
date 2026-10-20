import { FieldValue } from "firebase-admin/firestore";
import { apiError, getAdminServices } from "@/lib/firebase-admin";
import { createPaynow, normalizePaynowStatus } from "@/lib/paynow-server";
import { applyProviderPaymentUpdate } from "@/lib/payment-processor-server";
import { applyAssistPaymentUpdate } from "@/lib/assist-payment-server";
import {trustedPaynowUrl} from "@/lib/assist-payment-url";

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
    const intent = await db.collection("paymentIntents").doc(normalized.reference).get();
    if(!intent.exists)throw Object.assign(new Error("Payment intent not found."),{status:404});
    const apply = intent.data().model==="independent_shopping" ? applyAssistPaymentUpdate : applyProviderPaymentUpdate;
    const result = await apply(db, normalized.reference, normalized, { source: "paynow_webhook", messaging, auth });

    // Paynow recommends polling the transaction URL to confirm important status updates.
    // The signed callback is recorded first so a temporary poll failure cannot lose the provider event.
    if (normalized.pollUrl) {
      try {
        if(!trustedPaynowUrl(normalized.pollUrl))
          throw Object.assign(new Error("Paynow returned an untrusted polling URL."),{status:409});
        const polled = normalizePaynowStatus(await paynow.pollTransaction(normalized.pollUrl));
        if(polled.reference && polled.reference !== normalized.reference)
          throw Object.assign(new Error("The polled Paynow payment reference does not match the signed callback."), { status: 409 });
        polled.reference = normalized.reference;
        await apply(db, normalized.reference, polled, { source: "paynow_webhook_poll_confirmation", messaging, auth });
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
