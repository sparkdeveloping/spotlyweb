import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineCallable } from "./core/callable.js";
import {
  FOUNDATION_CAPABILITIES,
  SPOTLY_CONTRACT_SHA256,
  SPOTLY_CONTRACT_VERSION,
  SPOTLY_FUNCTIONS_REGION,
  SPOTLY_PROJECT_ID
} from "./core/platform.js";

setGlobalOptions({
  region: SPOTLY_FUNCTIONS_REGION,
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 50
});

export const platformFoundation = defineCallable({
  auth: "none",
  enforceAppCheck: false,
  handler: async () => ({
    projectId: SPOTLY_PROJECT_ID,
    functionsRegion: SPOTLY_FUNCTIONS_REGION,
    contractVersion: SPOTLY_CONTRACT_VERSION,
    contractSHA256: SPOTLY_CONTRACT_SHA256,
    capabilities: FOUNDATION_CAPABILITIES,
    serverTimeMs: Date.now()
  })
});

export const authenticatedFoundation = defineCallable({
  auth: "required",
  enforceAppCheck: false,
  handler: async ({ actor }) => ({
    uid: actor.uid,
    status: actor.profile?.status || "active",
    projectId: SPOTLY_PROJECT_ID,
    contractVersion: SPOTLY_CONTRACT_VERSION
  })
});
