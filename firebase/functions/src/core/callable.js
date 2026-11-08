import { randomUUID } from "node:crypto";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { SPOTLY_CONTRACT_SHA256, SPOTLY_CONTRACT_VERSION, SPOTLY_FUNCTIONS_REGION } from "./platform.js";
import { requireActiveAccount } from "./auth.js";

const DEFAULT_OPTIONS = Object.freeze({
  region: SPOTLY_FUNCTIONS_REGION,
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 50
});

function normalizeError(error, requestId) {
  if (error instanceof HttpsError) return error;
  logger.error("Unhandled Spotly callable error", { requestId, error: error?.stack || String(error) });
  return new HttpsError("internal", "Spotly could not complete this request.", { requestId });
}

export function defineCallable({ auth = "none", roles = [], permissions = [], enforceAppCheck = false, consumeAppCheckToken = false, options = {}, handler }) {
  return onCall({ ...DEFAULT_OPTIONS, enforceAppCheck, consumeAppCheckToken, ...options }, async (request) => {
    const requestId = randomUUID();
    try {
      const actor = auth === "required"
        ? await requireActiveAccount(request, { roles, permissions })
        : auth === "optional" && request.auth?.uid
          ? await requireActiveAccount(request, { roles, permissions })
          : null;
      const data = await handler({ request, actor, requestId });
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
      throw normalizeError(error, requestId);
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
  return defineCallable({ auth: "required", enforceAppCheck: true, consumeAppCheckToken: false, ...configuration });
}
