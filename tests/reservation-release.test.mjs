import assert from "node:assert/strict";
import test from "node:test";
import { releaseBookedSlot, releaseReservedQuantity } from "../lib/reservation-math.js";

test("reservation release never produces negative quantities", () => {
  assert.equal(releaseReservedQuantity(2, 5), 0);
  assert.equal(releaseReservedQuantity(5, 2), 3);
  assert.equal(releaseReservedQuantity(undefined, 1), 0);
});

test("pickup slot release is immutable and idempotent at zero", () => {
  const original = { slotA: 1, slotB: 3 };
  const released = releaseBookedSlot(original, "slotA");
  assert.deepEqual(original, { slotA: 1, slotB: 3 });
  assert.deepEqual(released, { slotA: 0, slotB: 3 });
  assert.deepEqual(releaseBookedSlot(released, "slotA"), { slotA: 0, slotB: 3 });
});
