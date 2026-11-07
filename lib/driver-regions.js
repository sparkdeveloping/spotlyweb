// Shared onboarding geography. Country is explicit account data; geolocation is only a suggestion.
export const DRIVER_COUNTRIES = Object.freeze({
  MW: { name: "Malawi", dialCode: "+265", cities: ["Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Kasungu", "Mangochi"], mobileMoney: ["Airtel Money", "TNM Mpamba"], banks: ["National Bank of Malawi", "Standard Bank Malawi", "FDH Bank", "NBS Bank", "First Capital Bank"] },
  ZW: { name: "Zimbabwe", dialCode: "+263", cities: ["Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo", "Chitungwiza", "Kwekwe", "Kadoma"], mobileMoney: ["EcoCash", "OneMoney", "InnBucks", "O'mari"], banks: ["CBZ", "Stanbic", "Steward Bank", "FBC", "CABS", "NMB", "ZB Bank", "First Capital Bank", "Nedbank Zimbabwe", "BancABC", "POSB"] },
  ZM: { name: "Zambia", dialCode: "+260", cities: ["Lusaka", "Ndola", "Kitwe", "Livingstone"], mobileMoney: ["Airtel Money", "MTN MoMo"], banks: [] },
  ZA: { name: "South Africa", dialCode: "+27", cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria"], mobileMoney: [], banks: [] },
  BW: { name: "Botswana", dialCode: "+267", cities: ["Gaborone", "Francistown", "Maun"], mobileMoney: ["Orange Money", "MyZaka"], banks: [] },
  TZ: { name: "Tanzania", dialCode: "+255", cities: ["Dar es Salaam", "Dodoma", "Arusha"], mobileMoney: ["M-Pesa", "Airtel Money", "Tigo Pesa"], banks: [] },
  KE: { name: "Kenya", dialCode: "+254", cities: ["Nairobi", "Mombasa", "Kisumu"], mobileMoney: ["M-Pesa", "Airtel Money"], banks: [] },
  UG: { name: "Uganda", dialCode: "+256", cities: ["Kampala", "Entebbe", "Jinja"], mobileMoney: ["MTN MoMo", "Airtel Money"], banks: [] },
  NG: { name: "Nigeria", dialCode: "+234", cities: ["Lagos", "Abuja", "Kano"], mobileMoney: [], banks: [] },
  GH: { name: "Ghana", dialCode: "+233", cities: ["Accra", "Kumasi", "Tamale"], mobileMoney: ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"], banks: [] }
});
export const DRIVER_COUNTRY_OPTIONS = Object.entries(DRIVER_COUNTRIES).map(([code, value]) => ({ code, ...value }));
export function countryName(code) { return DRIVER_COUNTRIES[String(code || "").toUpperCase()]?.name || "Africa"; }
export function validCountry(code) { return Boolean(DRIVER_COUNTRIES[String(code || "").toUpperCase()]); }
export function normalizeDriverPhone(value = "", countryCode = "") {
  let digits = String(value || "").replace(/\D/g, "");
  const dial = DRIVER_COUNTRIES[String(countryCode || "").toUpperCase()]?.dialCode.slice(1) || "";
  if (!digits) return "";
  if (String(value).trim().startsWith("+")) return `+${digits}`;
  if (dial && digits.startsWith(dial)) return `+${digits}`;
  if (!dial) return ""; // Never guess an international prefix.
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `+${dial}${digits}`;
}
export function validDriverContactPhone(value = "", countryCode = "") {
  const normalized = normalizeDriverPhone(value, countryCode);
  const digits = normalized.slice(1);
  const dial = DRIVER_COUNTRIES[String(countryCode || "").toUpperCase()]?.dialCode.slice(1);
  // Broad E.164 format validation; server-side verification still required when claiming a lead.
  return Boolean(dial && digits.startsWith(dial) && /^[1-9]\d{6,14}$/.test(digits) && digits.length > dial.length + 5);
}

// Registration interest may be collected more broadly, but current driver activation is limited to countries with existing Ride/service geography.
export const DRIVER_CURRENT_OPERATION_COUNTRIES = Object.freeze(["ZW", "MW"]);
export function driverCountryCanActivate(code) { return DRIVER_CURRENT_OPERATION_COUNTRIES.includes(String(code || "").toUpperCase()); }
