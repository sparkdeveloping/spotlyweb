import { randomUUID } from "node:crypto";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { SPOTLY_CONTRACT_SHA256, SPOTLY_CONTRACT_VERSION, SPOTLY_FUNCTIONS_REGION } from "./platform.js";
import { requireActiveAccount } from "./auth.js";
import { callableLogContext, enforceCallableRateLimit } from "./security.js";

const DEFAULT_OPTIONS = Object.freeze({
  region: SPOTLY_FUNCTIONS_REGION,
  memory: "256MiB",
  timeoutSeconds: 30,
  // Must match the deployment-safe global cap; onCall spreads these options.
  maxInstances: 2
});

function normalizeError(error, requestId) {
  if (error instanceof HttpsError) return error;
  logger.error("Unhandled Spotly callable error", { requestId, error: error?.stack || String(error) });
  return new HttpsError("internal", "Spotly could not complete this request.", { requestId });
}

export function defineCallable({ name = "callable", auth = "none", roles = [], permissions = [], enforceAppCheck = false, consumeAppCheckToken = false, rateLimit = null, options = {}, handler }) {
  return onCall({ ...DEFAULT_OPTIONS, enforceAppCheck, consumeAppCheckToken, ...options }, async (request) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    try {
      const actor = auth === "required"
        ? await requireActiveAccount(request, { roles, permissions })
        : auth === "optional" && request.auth?.uid
          ? await requireActiveAccount(request, { roles, permissions })
          : null;
      if (rateLimit) await enforceCallableRateLimit(request, { operation: name, ...rateLimit });
      const data = await handler({ request, actor, requestId });
      logger.info("Spotly callable completed", callableLogContext({ request, actor, requestId, operation: name, startedAt }));
      return {
        ok: true,
        data,
        meta: {
          requestId,
          contractVersion: SPOTLY_CONTRACT_VERSION,
          contractSHA256: SPOTLY_CONTRACT_SHA256
        }
      };
    } catch (error) {
      const normalized = normalizeError(error, requestId);
      const context = callableLogContext({ request, actor: null, requestId, operation: name, startedAt });
      if (normalized.code === "internal") logger.error("Spotly callable failed", { ...context, code: normalized.code });
      else logger.warn("Spotly callable rejected", { ...context, code: normalized.code });
      throw normalized;
    }
  });
}

// Trusted financial/dispatch mutations should use this helper. App Check is
// intentionally mandatory here even though the Phase 2 diagnostic callables do
// not enforce it yet. Future mutation migrations therefore fail closed by default.
export function defineTrustedMutation(configuration = {}) {
  // App Check enforcement is the safe default for new trusted mutations. Token
  // consumption/replay protection remains opt-in because Firebase requires an
  // additional IAM grant and it is not necessary for every mutation.
  return defineCallable({ auth: "required", enforceAppCheck: true, consumeAppCheckToken: false, rateLimit: { limit: 60, windowMs: 60_000 }, ...configuration });
}
