import "server-only";

function credentialsFor(currency = "USD") {
  const suffix = currency === "ZWG" ? "ZWG" : "USD";
  return {
    id: process.env[`PAYNOW_INTEGRATION_ID_${suffix}`] || process.env.PAYNOW_INTEGRATION_ID,
    key: process.env[`PAYNOW_INTEGRATION_KEY_${suffix}`] || process.env.PAYNOW_INTEGRATION_KEY
  };
}

export async function createPaynow(currency = "USD") {
  const credentials = credentialsFor(currency);
  if (!credentials.id || !credentials.key) {
    throw Object.assign(new Error(`Paynow ${currency} credentials are not configured.`), { status: 503 });
  }

  const module = await import("paynow");
  const Paynow = module.Paynow || module.default?.Paynow || module.default;
  if (!Paynow) throw new Error("The Paynow SDK could not be loaded.");
  return new Paynow(credentials.id, credentials.key);
}

export function normalizePaynowStatus(status) {
  const rawStatus = String(status?.status || "unknown").toLowerCase();
  let state = "pending";
  if (["paid", "awaiting delivery", "delivered"].includes(rawStatus)) state = "paid";
  else if (["cancelled", "failed", "disputed", "refunded"].includes(rawStatus)) state = rawStatus;

  return {
    state,
    providerStatus: rawStatus,
    paid: typeof status?.paid === "function" ? status.paid() : state === "paid",
    amount: Number(status?.amount || 0),
    reference: status?.reference || "",
    providerReference: status?.paynowreference || status?.paynowReference || "",
    error: status?.error || ""
  };
}
