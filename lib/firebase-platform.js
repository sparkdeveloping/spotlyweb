import { callFirebaseFunction } from "./firebase";
import { SPOTLY_CONTRACT_SHA256, SPOTLY_CONTRACT_VERSION } from "./contracts/generated";
import { SPOTLY_COUNTRY_CONTRACT_SHA256, SPOTLY_COUNTRY_CONTRACT_VERSION } from "./countries/generated";
import { SPOTLY_FIREBASE_FUNCTIONS_REGION, SPOTLY_FIREBASE_PROJECT_ID } from "./firebase-project-config";

export async function getFirebasePlatformFoundation() {
  const payload = await callFirebaseFunction("platformFoundation", {});
  const data = payload?.ok === true ? payload.data : null;
  if (!data) throw new Error("Spotly's Firebase platform returned an invalid foundation response.");
  if (data.projectId !== SPOTLY_FIREBASE_PROJECT_ID) throw new Error("Spotly's Firebase platform is connected to the wrong Firebase project.");
  if (data.functionsRegion !== SPOTLY_FIREBASE_FUNCTIONS_REGION) throw new Error("Spotly's Firebase platform is running in an unexpected Functions region.");
  if (data.contractVersion !== SPOTLY_CONTRACT_VERSION || data.contractSHA256 !== SPOTLY_CONTRACT_SHA256) {
    throw new Error("This Spotly client and Firebase platform use different contract versions. Update before continuing.");
  }
  if (data.countryContractVersion !== SPOTLY_COUNTRY_CONTRACT_VERSION || data.countryContractSHA256 !== SPOTLY_COUNTRY_CONTRACT_SHA256) {
    throw new Error("This Spotly client and Firebase platform use different country catalogs. Update before continuing.");
  }
  return data;
}
