import test from "node:test";
import assert from "node:assert/strict";
import { pickupAvailability } from "../lib/pickup-availability.js";

const everyDay = Object.fromEntries(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => [day, { open: "08:00", close: "12:00", closed: false }]));

test("pickup availability uses configured branch hours", () => {
  const result = pickupAvailability({ status: "active", openingHours: everyDay, pickup: { enabled: true, slotMinutes: 30, preparationMinutes: 0, slotCapacity: 2 } }, { now: new Date("2026-08-06T04:00:00.000Z"), days: 1 });
  assert.equal(result.available, true);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].slots[0].label, "08:00–08:30");
});

test("pickup availability excludes a fully booked slot", () => {
  const result = pickupAvailability({ status: "active", openingHours: everyDay, pickup: { enabled: true, slotMinutes: 30, preparationMinutes: 0, slotCapacity: 1, bookedSlots: { "2026-08-06:08:00": 1 } } }, { now: new Date("2026-08-06T04:00:00.000Z"), days: 1 });
  assert.equal(result.available, true);
  assert.notEqual(result.days[0].slots[0].start, "08:00");
});

test("paused locations do not expose pickup slots", () => {
  const result = pickupAvailability({ status: "paused", openingHours: everyDay, pickup: { enabled: true } });
  assert.equal(result.available, false);
  assert.equal(result.days.length, 0);
});
