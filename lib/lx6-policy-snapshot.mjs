/** Current publicly displayed pilot notices. Update only after publishing revised legal text. */
export const PILOT_POLICY = Object.freeze({
  terms: Object.freeze({ version: "2026-08-18", url: "https://www.spotlyafrica.com/terms" }),
  privacy: Object.freeze({ version: "2026-08-18", url: "https://www.spotlyafrica.com/privacy" })
});
export function driverConsentSnapshot({ agreementsAccepted, locationConsent, country }) {
  if (agreementsAccepted !== true || locationConsent !== true) {
    throw Object.assign(new Error("Read and accept the Spotly terms and working-location notice before submitting."), { status: 409 });
  }
  if (country !== "ZW" && country !== "MW") {
    throw Object.assign(new Error("Choose a supported operating country before submitting."), { status: 409 });
  }
  return {
    scope: "published_pilot_notices", country,
    termsVersion: PILOT_POLICY.terms.version, privacyVersion: PILOT_POLICY.privacy.version,
    termsUrl: PILOT_POLICY.terms.url, privacyUrl: PILOT_POLICY.privacy.url,
    driverSpecificAgreement: "not_yet_verified",
    method: "driver_onboarding"
  };
}
