import { countryDefinition, normalizeCountryCode } from "./country-engine.js";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function branchCountry(branch) {
  return countryDefinition(normalizeCountryCode(branch?.country));
}

function partsFor(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateKey(date = new Date(), timeZone = "UTC") {
  const parts = partsFor(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localWeekday(date = new Date(), timeZone = "UTC") {
  return partsFor(date, timeZone).weekday.toLowerCase();
}

// Backward-compatible exports for explicit Zimbabwe-only callers. Generic pickup
// availability below always resolves its timezone from the branch country.
export function harareDateKey(date = new Date()) {
  return localDateKey(date, "Africa/Harare");
}

export function harareWeekday(date = new Date()) {
  return localWeekday(date, "Africa/Harare");
}

function minutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function label(total) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function localDateTimeToUtc(dateKey, minuteOfDay, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(desiredWallClock);

  // Intl exposes timezone wall-clock parts but not the offset directly. Iterate
  // twice so this remains correct for future supported countries with DST too.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const rendered = partsFor(candidate, timeZone);
    const renderedWallClock = Date.UTC(
      Number(rendered.year),
      Number(rendered.month) - 1,
      Number(rendered.day),
      Number(rendered.hour),
      Number(rendered.minute),
      Number(rendered.second || 0)
    );
    candidate = new Date(candidate.getTime() + (desiredWallClock - renderedWallClock));
  }
  return candidate;
}

function specialHours(branch, dateKey) {
  const special = branch?.specialHours || branch?.openingExceptions || [];
  if (Array.isArray(special)) return special.find((item) => item.date === dateKey) || null;
  return special?.[dateKey] || null;
}

export function branchPaymentMethods(branch) {
  return Array.isArray(branch?.paymentMethods) ? branch.paymentMethods.filter(Boolean) : [];
}

export function branchAcceptedCurrencies(branch) {
  if (Array.isArray(branch?.acceptedCurrencies) && branch.acceptedCurrencies.length) return branch.acceptedCurrencies;
  return branchCountry(branch)?.currencyPriority || [];
}

export function pickupAvailability(branch, { now = new Date(), days = 7 } = {}) {
  if (!branch || branch.status === "paused" || branch.status === "closed" || branch.pickup?.enabled === false) {
    return { available: false, reason: branch?.pickup?.enabled === false ? "Pickup is not enabled for this location." : "This location is not accepting pickup orders.", days: [] };
  }
  const country = branchCountry(branch);
  if (!country) return { available: false, reason: "This location needs a supported country before pickup can be scheduled.", days: [] };
  const timeZone = country.timeZone;
  const locale = String(country.locale || "en").replace("_", "-");
  const openingHours = branch.openingHours || {};
  if (!Object.keys(openingHours).length) return { available: false, reason: "Pickup hours have not been configured for this location.", days: [] };
  const slotMinutes = Math.max(15, Number(branch.pickup?.slotMinutes || 30));
  const preparationMinutes = Math.max(0, Number(branch.pickup?.preparationMinutes || 45));
  const cutoffMinutes = Math.max(0, Number(branch.pickup?.cutoffMinutes || 0));
  const capacity = Math.max(1, Number(branch.pickup?.slotCapacity || 1));
  const booked = branch.pickup?.bookedSlots || {};
  const output = [];
  const todayKey = localDateKey(now, timeZone);

  for (let offset = 0; offset < days; offset += 1) {
    const base = new Date(now.getTime() + offset * 86400000);
    const dateKey = localDateKey(base, timeZone);
    const weekday = localWeekday(base, timeZone);
    const exception = specialHours(branch, dateKey);
    const hours = exception || openingHours[weekday];
    if (!hours || hours.closed) continue;
    const open = minutes(hours.open);
    const close = minutes(hours.close);
    if (open === null || close === null || close <= open) continue;
    const slots = [];
    for (let start = open; start + slotMinutes <= close - cutoffMinutes; start += slotMinutes) {
      const slotStart = localDateTimeToUtc(dateKey, start, timeZone);
      if (dateKey === todayKey && slotStart.getTime() < now.getTime() + preparationMinutes * 60000) continue;
      const key = `${dateKey}:${label(start)}`;
      const used = Number(booked[key] || 0);
      if (used >= capacity) continue;
      slots.push({
        id: key,
        start: label(start),
        end: label(start + slotMinutes),
        label: `${label(start)}–${label(start + slotMinutes)}`,
        remaining: Math.max(0, capacity - used)
      });
    }
    if (slots.length) output.push({
      date: dateKey,
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : base.toLocaleDateString(locale, { timeZone, weekday: "short", day: "numeric", month: "short" }),
      slots
    });
  }

  return output.length
    ? { available: true, reason: "", days: output, earliest: { date: output[0].date, slot: output[0].slots[0] } }
    : { available: false, reason: "No pickup times are currently available for this location.", days: [] };
}
