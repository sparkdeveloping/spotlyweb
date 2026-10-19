/**
 * ISO 3166-1 alpha-2 codes for Africa's 54 widely recognized sovereign states.
 * Supports adding market records without pretending that local payment or fulfilment
 * providers are already live. Currency, language and timezone are configured per market.
 */
export const AFRICAN_COUNTRIES = Object.freeze([
  ["DZ","Algeria"],["AO","Angola"],["BJ","Benin"],["BW","Botswana"],["BF","Burkina Faso"],
  ["BI","Burundi"],["CV","Cabo Verde"],["CM","Cameroon"],["CF","Central African Republic"],
  ["TD","Chad"],["KM","Comoros"],["CD","DR Congo"],["CG","Republic of the Congo"],
  ["CI","Côte d’Ivoire"],["DJ","Djibouti"],["EG","Egypt"],["GQ","Equatorial Guinea"],
  ["ER","Eritrea"],["SZ","Eswatini"],["ET","Ethiopia"],["GA","Gabon"],["GM","Gambia"],
  ["GH","Ghana"],["GN","Guinea"],["GW","Guinea-Bissau"],["KE","Kenya"],["LS","Lesotho"],
  ["LR","Liberia"],["LY","Libya"],["MG","Madagascar"],["MW","Malawi"],["ML","Mali"],
  ["MR","Mauritania"],["MU","Mauritius"],["MA","Morocco"],["MZ","Mozambique"],
  ["NA","Namibia"],["NE","Niger"],["NG","Nigeria"],["RW","Rwanda"],
  ["ST","São Tomé and Príncipe"],["SN","Senegal"],["SC","Seychelles"],["SL","Sierra Leone"],
  ["SO","Somalia"],["ZA","South Africa"],["SS","South Sudan"],["SD","Sudan"],
  ["TZ","Tanzania"],["TG","Togo"],["TN","Tunisia"],["UG","Uganda"],["ZM","Zambia"],["ZW","Zimbabwe"]
].map(([code,name]) => Object.freeze({code,name})));
export const AFRICAN_COUNTRY_CODES = new Set(AFRICAN_COUNTRIES.map((country)=>country.code));
export function africaCountry(code) {
  return AFRICAN_COUNTRIES.find((item)=>item.code===String(code||"").toUpperCase())||null;
}
