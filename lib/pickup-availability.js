const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ZW_TIMEZONE = "Africa/Harare";

function partsFor(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZW_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function harareDateKey(date = new Date()) {
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function harareWeekday(date = new Date()) {
  return partsFor(date).weekday.toLowerCase();
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

function dateAtHarareDay(dateKey, minuteOfDay) {
  const [year, month, day] = dateKey.split("-").map(Number);
  // Africa/Harare is UTC+2 year-round. Use UTC for deterministic slot comparisons.
  return new Date(Date.UTC(year, month - 1, day, Math.floor(minuteOfDay / 60) - 2, minuteOfDay % 60));
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
  return Array.isArray(branch?.acceptedCurrencies) && branch.acceptedCurrencies.length ? branch.acceptedCurrencies : ["USD"];
}

export function pickupAvailability(branch, { now = new Date(), days = 7 } = {}) {
  if (!branch || branch.status === "paused" || branch.status === "closed" || branch.pickup?.enabled === false) {
    return { available: false, reason: branch?.pickup?.enabled === false ? "Pickup is not enabled for this location." : "This location is not accepting pickup orders.", days: [] };
  }
  const openingHours = branch.openingHours || {};
  if (!Object.keys(openingHours).length) return { available: false, reason: "Pickup hours have not been configured for this location.", days: [] };
  const slotMinutes = Math.max(15, Number(branch.pickup?.slotMinutes || 30));
  const preparationMinutes = Math.max(0, Number(branch.pickup?.preparationMinutes || 45));
  const cutoffMinutes = Math.max(0, Number(branch.pickup?.cutoffMinutes || 0));
  const capacity = Math.max(1, Number(branch.pickup?.slotCapacity || 1));
  const booked = branch.pickup?.bookedSlots || {};
  const output = [];
  const todayKey = harareDateKey(now);

  for (let offset = 0; offset < days; offset += 1) {
    const base = new Date(now.getTime() + offset * 86400000);
    const dateKey = harareDateKey(base);
    const weekday = harareWeekday(base);
    const exception = specialHours(branch, dateKey);
    const hours = exception || openingHours[weekday];
    if (!hours || hours.closed) continue;
    const open = minutes(hours.open);
    const close = minutes(hours.close);
    if (open === null || close === null || close <= open) continue;
    const slots = [];
    for (let start = open; start + slotMinutes <= close - cutoffMinutes; start += slotMinutes) {
      const slotStart = dateAtHarareDay(dateKey, start);
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
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : base.toLocaleDateString("en-ZW", { timeZone: ZW_TIMEZONE, weekday: "short", day: "numeric", month: "short" }),
      slots
    });
  }

  return output.length
    ? { available: true, reason: "", days: output, earliest: { date: output[0].date, slot: output[0].slots[0] } }
    : { available: false, reason: "No pickup times are currently available for this location.", days: [] };
}
