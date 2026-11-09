import { SPOTLY_COUNTRIES, SPOTLY_COUNTRY_CODES } from "./countries/generated.js";

const byCode = new Map(SPOTLY_COUNTRIES.map((country) => [country.code, country]));
export { SPOTLY_COUNTRIES, SPOTLY_COUNTRY_CODES };

export function normalizeCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return byCode.has(code) ? code : null;
}

export function countryDefinition(value) {
  const code = normalizeCountryCode(value);
  return code ? byCode.get(code) : null;
}

export function countryFromCoordinates(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return SPOTLY_COUNTRIES.find((country) => lat >= country.bounds.minLat && lat <= country.bounds.maxLat && lng >= country.bounds.minLng && lng <= country.bounds.maxLng)?.code || null;
}

export function countryForCity(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return null;
  for (const country of SPOTLY_COUNTRIES) {
    const city = country.cities.find((item) => item.id === clean || item.name.toLowerCase() === clean);
    if (city) return { country, city };
  }
  return null;
}

export function countryCity(countryCode, value) {
  const country = countryDefinition(countryCode);
  const clean = String(value || "").trim().toLowerCase();
  if (!country || !clean) return null;
  return country.cities.find((city) => city.id === clean || city.name.toLowerCase() === clean) || null;
}

export function normalizePhoneForCountry(value, countryCode) {
  const country = countryDefinition(countryCode);
  if (!country) throw new Error("Choose a supported country before entering a phone number.");
  const raw = String(value || "").trim();
  if (!raw) return "";
  let digits = raw.replace(/[^0-9]/g, "");
  const dialDigits = country.dialCode.replace("+", "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(dialDigits)) digits = digits.slice(dialDigits.length);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < country.phone.nationalMinDigits || digits.length > country.phone.nationalMaxDigits) {
    throw new Error(`Enter a valid ${country.name} phone number.`);
  }
  return `${country.dialCode}${digits}`;
}

export function resolveCountryContext({ overrideCountryCode, preferenceCountryCode, location, suggestedCountryCode } = {}) {
  const override = normalizeCountryCode(overrideCountryCode);
  if (override) return { countryCode: override, source: "admin_override", locked: true };
  const preference = normalizeCountryCode(preferenceCountryCode);
  if (preference) return { countryCode: preference, source: "account_preference", locked: false };
  const locationCode = countryFromCoordinates(location);
  if (locationCode) return { countryCode: locationCode, source: "device_location", locked: false, suggested: true };
  const suggested = normalizeCountryCode(suggestedCountryCode);
  if (suggested) return { countryCode: suggested, source: "device_location", locked: false, suggested: true };
  return { countryCode: null, source: "unresolved", locked: false };
}

export function countryTimeZone(code) { return countryDefinition(code)?.timeZone || "UTC"; }
export function countryCurrencies(code) { return countryDefinition(code)?.currencyPriority || []; }
export function countryCities(code) { return countryDefinition(code)?.cities || []; }
