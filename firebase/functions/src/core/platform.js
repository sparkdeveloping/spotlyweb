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

const serviceAvailabilityManifestUrl = new URL("../contracts/spotly-service-availability.v1.json", import.meta.url);
const serviceAvailabilityManifestBytes = readFileSync(fileURLToPath(serviceAvailabilityManifestUrl));
export const SPOTLY_SERVICE_AVAILABILITY_CONTRACT = Object.freeze(JSON.parse(serviceAvailabilityManifestBytes));
export const SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION = SPOTLY_SERVICE_AVAILABILITY_CONTRACT.serviceAvailabilityContractVersion;
export const SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256 = createHash("sha256").update(serviceAvailabilityManifestBytes).digest("hex");

const customerRuntimeManifestUrl = new URL("../contracts/spotly-customer-runtime.v1.json", import.meta.url);
const customerRuntimeManifestBytes = readFileSync(fileURLToPath(customerRuntimeManifestUrl));
export const SPOTLY_CUSTOMER_RUNTIME_CONTRACT = Object.freeze(JSON.parse(customerRuntimeManifestBytes));
export const SPOTLY_CUSTOMER_RUNTIME_CONTRACT_VERSION = SPOTLY_CUSTOMER_RUNTIME_CONTRACT.customerRuntimeContractVersion;
export const SPOTLY_CUSTOMER_RUNTIME_CONTRACT_SHA256 = createHash("sha256").update(customerRuntimeManifestBytes).digest("hex");

const mediaDiscoveryManifestUrl = new URL("../contracts/spotly-media-discovery.v1.json", import.meta.url);
const mediaDiscoveryManifestBytes = readFileSync(fileURLToPath(mediaDiscoveryManifestUrl));
export const SPOTLY_MEDIA_DISCOVERY_CONTRACT = Object.freeze(JSON.parse(mediaDiscoveryManifestBytes));
export const SPOTLY_MEDIA_DISCOVERY_CONTRACT_VERSION = SPOTLY_MEDIA_DISCOVERY_CONTRACT.version;
export const SPOTLY_MEDIA_DISCOVERY_CONTRACT_SHA256 = createHash("sha256").update(mediaDiscoveryManifestBytes).digest("hex");

export const FOUNDATION_CAPABILITIES = Object.freeze({
  firestore: true,
  realtimeDatabase: true,
  storage: true,
  messaging: true,
  callableFunctions: true,
  appCheckReady: true,
  emulatorReady: true,
  operationsGrants: true,
  customerRuntime: true,
  customerMobilityQuotes: true,
  customerDiscovery: true,
  approvedMedia: true
});
