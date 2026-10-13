function safePart(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
}

function dateAtZimbabweMidnight(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function bookingDateKeys(startDate, endDate) {
  const start = dateAtZimbabweMidnight(startDate);
  const end = dateAtZimbabweMidnight(endDate || startDate);
  if (!start || !end || end < start) return [];
  const values = [];
  const sameDay = start.getTime() === end.getTime();
  const cursor = new Date(start);
  // Multi-day stays reserve nights (end date is checkout and therefore exclusive).
  // Same-day activities reserve that one calendar day.
  while (cursor < end || (sameDay && values.length === 0)) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (values.length >= 62) break;
  }
  return values;
}

export function appointmentReservationSpecs({ itemId, date, time, capacity }) {
  const max = Math.max(0, Number(capacity || 0));
  if (!itemId || !date || !time || max <= 0) return [];
  return [{
    id: `${safePart(itemId)}_appointment_${safePart(date)}_${safePart(time)}`,
    key: `${date} ${time}`,
    units: 1,
    capacity: max,
    kind: "appointment"
  }];
}

export function bookingReservationSpecs({ itemId, startDate, endDate, capacity, guests = 1, capacityMode = "booking" }) {
  const max = Math.max(0, Number(capacity || 0));
  if (!itemId || max <= 0) return [];
  const units = capacityMode === "guests" ? Math.max(1, Number(guests || 1)) : 1;
  return bookingDateKeys(startDate, endDate).map((date) => ({
    id: `${safePart(itemId)}_booking_${safePart(date)}`,
    key: date,
    units,
    capacity: max,
    kind: "booking"
  }));
}

export function reservationCanFit(currentReserved, units, capacity) {
  const current = Math.max(0, Number(currentReserved || 0));
  const nextUnits = Math.max(0, Number(units || 0));
  const max = Math.max(0, Number(capacity || 0));
  return max <= 0 || current + nextUnits <= max;
}

export function reservationReleaseCount(currentReserved, units) {
  return Math.max(0, Math.max(0, Number(currentReserved || 0)) - Math.max(0, Number(units || 0)));
}
