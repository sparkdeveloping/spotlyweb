import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  appointmentSlotAllowed,
  appointmentSlotTimes,
  bookingRangeValidation,
  cancellationDeadlineMs,
  localDateTimeEpoch,
  ticketRules
} from "../lib/book-live-domain.js";

const NOW = Date.parse("2026-11-09T12:00:00.000Z"); // Monday

test("Phase 13 appointment availability is schedule, lead-time and timezone aware", () => {
  const product = {
    durationMinutes: 30,
    slotIntervalMinutes: 30,
    minLeadMinutes: 60,
    maxAdvanceDays: 30,
    capacity: 2,
    availabilitySchedule: { monday: [{ start: "09:00", end: "17:00" }] }
  };
  const slots = appointmentSlotTimes({ product, date: "2026-11-09", timeZone: "UTC", nowMs: NOW });
  assert.equal(slots.includes("12:30"), false);
  assert.equal(slots.includes("13:00"), true);
  assert.equal(appointmentSlotAllowed({ product, date: "2026-11-09", time: "13:00", timeZone: "UTC", nowMs: NOW }), true);
  assert.equal(appointmentSlotAllowed({ product, date: "2026-11-10", time: "13:00", timeZone: "UTC", nowMs: NOW }), false);
});

test("Phase 13 booking rules enforce stay bounds, lead time and blackout dates", () => {
  const product = { minStayDays: 2, maxStayDays: 7, minLeadMinutes: 60, maxAdvanceDays: 90, blackoutDates: ["2026-11-13"] };
  assert.equal(bookingRangeValidation({ product, startDate: "2026-11-10", endDate: "2026-11-11", timeZone: "UTC", nowMs: NOW }).ok, false);
  assert.equal(bookingRangeValidation({ product, startDate: "2026-11-10", endDate: "2026-11-12", timeZone: "UTC", nowMs: NOW }).ok, true);
  assert.equal(bookingRangeValidation({ product, startDate: "2026-11-12", endDate: "2026-11-14", timeZone: "UTC", nowMs: NOW }).ok, false);
});

test("Phase 14 ticket rules enforce sales windows, event identity and purchase limits", () => {
  const product = {
    id: "tier-vip",
    eventId: "festival-2026",
    eventName: "Spotly Festival",
    ticketTier: "VIP",
    startsAt: "2026-12-01T18:00:00.000Z",
    salesStartAt: "2026-11-01T00:00:00.000Z",
    salesEndAt: "2026-11-30T23:59:00.000Z",
    maxQuantity: 4,
    transferable: true
  };
  const rules = ticketRules(product, NOW);
  assert.equal(rules.salesOpen, true);
  assert.equal(rules.eventId, "festival-2026");
  assert.equal(rules.ticketTier, "VIP");
  assert.equal(rules.maxQuantity, 4);
  assert.equal(ticketRules(product, Date.parse("2026-12-02T00:00:00Z")).salesOpen, false);
});

test("Book and Live cancellation deadlines are derived from the real scheduled time", () => {
  const appointment = { cancellationCutoffMinutes: 120 };
  const order = { appointment: { date: "2026-11-10", time: "14:00" }, timeZone: "Africa/Harare" };
  const start = localDateTimeEpoch("2026-11-10", "14:00", "Africa/Harare");
  assert.equal(cancellationDeadlineMs({ kind: "appointment", product: appointment, order }), start - 120 * 60_000);
});

test("Phase 13/14 production routes and ownership lifecycle are present", () => {
  const create = fs.readFileSync(new URL("../app/api/customer/transactions/create/route.js", import.meta.url), "utf8");
  const cancel = fs.readFileSync(new URL("../app/api/customer/transactions/cancel/route.js", import.meta.url), "utf8");
  const reschedule = fs.readFileSync(new URL("../app/api/customer/transactions/reschedule/route.js", import.meta.url), "utf8");
  const entitlements = fs.readFileSync(new URL("../lib/ticket-entitlements-server.js", import.meta.url), "utf8");
  const availability = fs.readFileSync(new URL("../app/api/public/transactions/availability/route.js", import.meta.url), "utf8");
  assert.match(create, /appointmentSlotAllowed/);
  assert.match(create, /ticketRules/);
  assert.match(cancel, /refundRequests/);
  assert.match(reschedule, /availabilityReservations/);
  assert.match(entitlements, /ticketEntitlements/);
  assert.match(availability, /salesOpen/);
});
