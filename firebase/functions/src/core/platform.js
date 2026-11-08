import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SPOTLY_PROJECT_ID = "spotly-africa";
export const SPOTLY_FUNCTIONS_REGION = "europe-west1";
export const SPOTLY_DATABASE_URL = "https://spotly-africa-default-rtdb.europe-west1.firebasedatabase.app";

const manifestUrl = new URL("../contracts/spotly-contracts.v1.json", import.meta.url);
const manifestBytes = readFileSync(fileURLToPath(manifestUrl));
export const SPOTLY_CONTRACT = Object.freeze(JSON.parse(manifestBytes));
export const SPOTLY_CONTRACT_VERSION = SPOTLY_CONTRACT.contractVersion;
export const SPOTLY_CONTRACT_SHA256 = createHash("sha256").update(manifestBytes).digest("hex");

const countryManifestUrl = new URL("../contracts/spotly-countries.v1.json", import.meta.url);
const countryManifestBytes = readFileSync(fileURLToPath(countryManifestUrl));
export const SPOTLY_COUNTRY_CONTRACT = Object.freeze(JSON.parse(countryManifestBytes));
export const SPOTLY_COUNTRY_CONTRACT_VERSION = SPOTLY_COUNTRY_CONTRACT.countryContractVersion;
export const SPOTLY_COUNTRY_CONTRACT_SHA256 = createHash("sha256").update(countryManifestBytes).digest("hex");

export const FOUNDATION_CAPABILITIES = Object.freeze({
  firestore: true,
  realtimeDatabase: true,
  storage: true,
  messaging: true,
  callableFunctions: true,
  appCheckReady: true,
  emulatorReady: true
});
