const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function dateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? value : null;
}

export function addDays(value, amount) {
  const key = dateKey(value);
  if (!key) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startDate, endDate) {
  const start = dateKey(startDate);
  const end = dateKey(endDate);
  if (!start || !end) return null;
  return Math.round((new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${start}T00:00:00.000Z`).getTime()) / 86_400_000);
}

export function dayName(value) {
  const key = dateKey(value);
  if (!key) return null;
  return DAY_NAMES[new Date(`${key}T00:00:00.000Z`).getUTCDay()];
}

export function localDateTimeEpoch(date, time, timeZone) {
  const key = dateKey(date);
  const match = String(time || "").match(/^(\d{2}):(\d{2})$/);
  if (!key || !match) return null;
  const [year, month, day] = key.split("-").map(Number);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(wallUtc));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const epoch = wallUtc - (represented - wallUtc);
    return Number.isFinite(epoch) ? epoch : null;
  } catch {
    return null;
  }
}

function parseTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function timeLabel(minutes) {
  const normalized = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function defaultAppointmentSchedule() {
  return {
    monday: [{ start: "09:00", end: "17:00" }],
    tuesday: [{ start: "09:00", end: "17:00" }],
    wednesday: [{ start: "09:00", end: "17:00" }],
    thursday: [{ start: "09:00", end: "17:00" }],
    friday: [{ start: "09:00", end: "17:00" }],
    saturday: [],
    sunday: []
  };
}

export function normalizedAppointmentSchedule(product = {}) {
  const source = product.availabilitySchedule && typeof product.availabilitySchedule === "object" ? product.availabilitySchedule : defaultAppointmentSchedule();
  return Object.fromEntries(DAY_NAMES.map((name) => {
    const windows = Array.isArray(source[name]) ? source[name] : [];
    const valid = windows.map((window) => ({ start: String(window?.start || ""), end: String(window?.end || "") }))
      .filter((window) => parseTime(window.start) !== null && parseTime(window.end) !== null && parseTime(window.end) > parseTime(window.start));
    return [name, valid];
  }));
}

export function appointmentRules(product = {}) {
  return {
    durationMinutes: Math.max(5, Math.min(12 * 60, number(product.durationMinutes, 30))),
    slotIntervalMinutes: Math.max(5, Math.min(240, number(product.slotIntervalMinutes, product.durationMinutes || 30))),
    minLeadMinutes: Math.max(0, Math.min(30 * 24 * 60, number(product.minLeadMinutes, 60))),
    maxAdvanceDays: Math.max(1, Math.min(730, number(product.maxAdvanceDays, 90))),
    cancellationCutoffMinutes: Math.max(0, Math.min(30 * 24 * 60, number(product.cancellationCutoffMinutes, 120))),
    rescheduleCutoffMinutes: Math.max(0, Math.min(30 * 24 * 60, number(product.rescheduleCutoffMinutes, product.cancellationCutoffMinutes ?? 120))),
    capacity: Math.max(0, number(product.capacity, 1)),
    blackoutDates: Array.isArray(product.blackoutDates) ? product.blackoutDates.map(String).filter(dateKey) : []
  };
}

export function appointmentSlotTimes({ product = {}, date, timeZone = "UTC", nowMs = Date.now() }) {
  const key = dateKey(date);
  if (!key) return [];
  const rules = appointmentRules(product);
  if (rules.blackoutDates.includes(key)) return [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowMs));
  const advance = daysBetween(today, key);
  if (advance === null || advance < 0 || advance > rules.maxAdvanceDays) return [];
  const schedule = normalizedAppointmentSchedule(product);
  const windows = schedule[dayName(key)] || [];
  const values = [];
  for (const window of windows) {
    const start = parseTime(window.start);
    const end = parseTime(window.end);
    if (start === null || end === null) continue;
    for (let cursor = start; cursor + rules.durationMinutes <= end; cursor += rules.slotIntervalMinutes) {
      const time = timeLabel(cursor);
      const epoch = localDateTimeEpoch(key, time, timeZone);
      if (!Number.isFinite(epoch) || epoch < nowMs + rules.minLeadMinutes * 60_000) continue;
      values.push(time);
      if (values.length >= 96) break;
    }
  }
  return [...new Set(values)].sort();
}

export function appointmentSlotAllowed({ product = {}, date, time, timeZone = "UTC", nowMs = Date.now() }) {
  return appointmentSlotTimes({ product, date, timeZone, nowMs }).includes(String(time || ""));
}

export function bookingRules(product = {}) {
  return {
    minStayDays: Math.max(1, Math.min(60, number(product.minStayDays, 1))),
    maxStayDays: Math.max(1, Math.min(90, number(product.maxStayDays, 30))),
    minLeadMinutes: Math.max(0, Math.min(30 * 24 * 60, number(product.minLeadMinutes, 60))),
    maxAdvanceDays: Math.max(1, Math.min(730, number(product.maxAdvanceDays, 365))),
    cancellationCutoffMinutes: Math.max(0, Math.min(60 * 24 * 60, number(product.cancellationCutoffMinutes, 24 * 60))),
    rescheduleCutoffMinutes: Math.max(0, Math.min(60 * 24 * 60, number(product.rescheduleCutoffMinutes, product.cancellationCutoffMinutes ?? 24 * 60))),
    capacity: Math.max(0, number(product.capacity, 1)),
    capacityMode: product.capacityMode === "guests" ? "guests" : "booking",
    blackoutDates: Array.isArray(product.blackoutDates) ? product.blackoutDates.map(String).filter(dateKey) : []
  };
}

export function bookingRangeValidation({ product = {}, startDate, endDate, timeZone = "UTC", nowMs = Date.now() }) {
  const start = dateKey(startDate);
  const end = dateKey(endDate || startDate);
  if (!start || !end) return { ok: false, reason: "Choose valid booking dates." };
  const rules = bookingRules(product);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(nowMs));
  const advance = daysBetween(today, start);
  if (advance === null || advance < 0) return { ok: false, reason: "Choose a future booking date." };
  if (advance > rules.maxAdvanceDays) return { ok: false, reason: `Bookings open up to ${rules.maxAdvanceDays} days ahead.` };
  const startEpoch = localDateTimeEpoch(start, "00:00", timeZone);
  if (Number.isFinite(startEpoch) && startEpoch < nowMs + rules.minLeadMinutes * 60_000) return { ok: false, reason: "That booking starts too soon." };
  const length = daysBetween(start, end);
  if (length === null || length < 0) return { ok: false, reason: "The end date must be after the start date." };
  const effectiveLength = length === 0 ? 1 : length;
  if (effectiveLength < rules.minStayDays) return { ok: false, reason: `This booking requires at least ${rules.minStayDays} day${rules.minStayDays === 1 ? "" : "s"}.` };
  if (effectiveLength > rules.maxStayDays) return { ok: false, reason: `This booking allows up to ${rules.maxStayDays} days per reservation.` };
  const dates = [];
  for (let cursor = start, count = 0; count < effectiveLength; count += 1, cursor = addDays(cursor, 1)) dates.push(cursor);
  if (dates.some((value) => rules.blackoutDates.includes(value))) return { ok: false, reason: "One or more selected dates are unavailable." };
  return { ok: true, startDate: start, endDate: end, dates, nightsOrDays: effectiveLength, rules };
}

function plainDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function ticketRules(product = {}, nowMs = Date.now()) {
  const startsAt = plainDate(product.startsAt);
  const salesStartAt = plainDate(product.salesStartAt);
  const salesEndAt = plainDate(product.salesEndAt);
  const salesOpen = (!salesStartAt || salesStartAt.getTime() <= nowMs) && (!salesEndAt || salesEndAt.getTime() > nowMs) && (!startsAt || startsAt.getTime() > nowMs);
  return {
    startsAt,
    endsAt: plainDate(product.endsAt),
    salesStartAt,
    salesEndAt,
    salesOpen,
    transferable: product.transferable !== false,
    cancellationCutoffMinutes: Math.max(0, Math.min(60 * 24 * 60, number(product.cancellationCutoffMinutes, 24 * 60))),
    maxQuantity: Math.max(1, Math.min(50, number(product.maxQuantity, 10))),
    eventId: String(product.eventId || product.eventKey || product.id || ""),
    eventName: String(product.eventName || product.name || "Event"),
    ticketTier: String(product.ticketTier || product.variant || product.name || "Standard")
  };
}

export function cancellationDeadlineMs({ kind, product = {}, order = {} }) {
  if (kind === "appointment") {
    const rules = appointmentRules(product);
    const start = localDateTimeEpoch(order.appointment?.date, order.appointment?.time, order.timeZone || "UTC");
    return Number.isFinite(start) ? start - rules.cancellationCutoffMinutes * 60_000 : null;
  }
  if (kind === "booking") {
    const rules = bookingRules(product);
    const start = localDateTimeEpoch(order.booking?.startDate, "00:00", order.timeZone || "UTC");
    return Number.isFinite(start) ? start - rules.cancellationCutoffMinutes * 60_000 : null;
  }
  if (kind === "ticket") {
    const rules = ticketRules(product);
    return rules.startsAt ? rules.startsAt.getTime() - rules.cancellationCutoffMinutes * 60_000 : null;
  }
  return null;
}

export function rescheduleDeadlineMs({ kind, product = {}, order = {} }) {
  if (kind === "appointment") {
    const rules = appointmentRules(product);
    const start = localDateTimeEpoch(order.appointment?.date, order.appointment?.time, order.timeZone || "UTC");
    return Number.isFinite(start) ? start - rules.rescheduleCutoffMinutes * 60_000 : null;
  }
  if (kind === "booking") {
    const rules = bookingRules(product);
    const start = localDateTimeEpoch(order.booking?.startDate, "00:00", order.timeZone || "UTC");
    return Number.isFinite(start) ? start - rules.rescheduleCutoffMinutes * 60_000 : null;
  }
  return null;
}
