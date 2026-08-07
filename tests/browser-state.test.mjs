import test from "node:test";
import assert from "node:assert/strict";
import { clearUserSessionState, readState, scopedStateKey, writeState } from "../lib/browser-state.js";

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

global.window = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };

test("account state keys are scoped by user", () => {
  const first = { uid: "first", isAnonymous: false };
  const second = { uid: "second", isAnonymous: false };
  writeState("spotly-marketplace-cart", first, { a: 1 });
  writeState("spotly-marketplace-cart", second, { b: 2 });
  assert.deepEqual(readState("spotly-marketplace-cart", first, {}), { a: 1 });
  assert.deepEqual(readState("spotly-marketplace-cart", second, {}), { b: 2 });
  assert.notEqual(scopedStateKey("spotly-marketplace-cart", first), scopedStateKey("spotly-marketplace-cart", second));
});

test("logout cleanup removes only the current user state", () => {
  const first = { uid: "first", isAnonymous: false };
  const second = { uid: "second", isAnonymous: false };
  writeState("spotly-checkout-draft", first, { phone: "one" });
  writeState("spotly-checkout-draft", second, { phone: "two" });
  clearUserSessionState(first);
  assert.equal(readState("spotly-checkout-draft", first, null), null);
  assert.deepEqual(readState("spotly-checkout-draft", second, null), { phone: "two" });
});
