import { countryCity, countryDefinition } from "./country-engine.js";
import { validDriverContactPhone } from "./driver-regions.js";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_MESSAGES = Object.freeze({
  legalName: "Enter your full name (2–160 characters).",
  country: "Choose a supported country.",
  city: "Choose a city in the selected country.",
  phone: "Enter a valid phone number for the selected country.",
  email: "Enter a valid email address, such as name@example.com.",
  vehicleType: "Choose a supported vehicle type.",
  requestedCapabilities: "Choose work types available for your vehicle.",
  licenceStatus: "Choose a valid licence status.",
  contactPreference: "Choose a valid contact method.",
});

/** Validates step-one values before allowing the user to navigate away from them. */
export function validateDriverLeadContact(input = {}) {
  const errors = {};
  const legalName = String(input.legalName || "").trim();
  const country = String(input.country || "").trim();
  const city = String(input.city || "").trim();
  const phone = String(input.phone || "").trim();
  const email = String(input.email || "").trim();

  if (legalName.length < 2 || legalName.length > 160) errors.legalName = PUBLIC_MESSAGES.legalName;
  if (!countryDefinition(country)) errors.country = PUBLIC_MESSAGES.country;
  if (!countryCity(country, city)) errors.city = PUBLIC_MESSAGES.city;
  if (!phone && !email) errors.phone = "Add a phone number or email address so our Driver team can contact you.";
  if (phone && (phone.length > 40 || !validDriverContactPhone(phone, country))) errors.phone = PUBLIC_MESSAGES.phone;
  if (email && (email.length > 254 || !EMAIL_FORMAT.test(email))) errors.email = PUBLIC_MESSAGES.email;
  return errors;
}

/** Only return safe, known user-editable fields; never expose raw Zod issue internals. */
export function publicDriverLeadFieldErrors(issues = []) {
  const errors = {};
  for (const issue of issues) {
    const path = issue?.path || [];
    const field = path[0] === "lead" ? path[1] : path[0];
    if (Object.hasOwn(PUBLIC_MESSAGES, field) && !errors[field]) errors[field] = PUBLIC_MESSAGES[field];
  }
  return errors;
}
