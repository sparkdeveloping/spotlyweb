import test from "node:test";
import assert from "node:assert/strict";
import { nxtRole, hasNxtPermission, canDelegateNxtRole } from "../lib/nxt-policy.js";

test("NXT access checks tolerate profiles that have not loaded", () => {
  for (const profile of [null, undefined, {}, { roles: null }, { roles: "nxt_manager" }]) {
    assert.equal(nxtRole(profile), null);
    assert.equal(hasNxtPermission(profile, "read"), false);
    assert.equal(hasNxtPermission(profile, "team"), false);
    assert.equal(canDelegateNxtRole(profile, "nxt_outreach"), false);
  }
});
test("An NXT lead has scoped permissions but cannot grant lead or platform roles", () => {
  const lead = { roles: ["nxt_manager"] };
  assert.equal(hasNxtPermission(lead, "read"), true);
  assert.equal(hasNxtPermission(lead, "team"), true);
  assert.equal(hasNxtPermission(lead, "admin.configuration"), false);
  assert.equal(canDelegateNxtRole(lead, "nxt_outreach"), true);
  assert.equal(canDelegateNxtRole(lead, "nxt_manager"), false);
  assert.equal(canDelegateNxtRole(lead, "platform_admin"), false);
});
test("A Spotly administrator retains NXT access and explicit role assignment authority", () => {
  const admin = { roles: ["platform_admin"] };
  assert.equal(hasNxtPermission(admin, "read"), true);
  assert.equal(canDelegateNxtRole(admin, "nxt_manager"), true);
});
