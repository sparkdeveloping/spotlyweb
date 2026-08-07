import test from "node:test";
import assert from "node:assert/strict";
import { settingsRouteForWorkspace, workspaceAccess } from "../lib/workspaces.js";

test("workspace access follows actual access records rather than display-name matching", () => {
  const access = workspaceAccess({ profile: { roles: ["customer"], workspaceAccess: ["staff"] }, memberships: [{ businessId: "business-1", status: "active" }] });
  assert.equal(access.has("customer"), true);
  assert.equal(access.has("business"), true);
  assert.equal(access.has("staff"), true);
  assert.equal(access.has("driver"), false);
});

test("workspace settings use explicit valid destinations", () => {
  assert.equal(settingsRouteForWorkspace("customer"), "/account");
  assert.equal(settingsRouteForWorkspace("business"), "/business/settings");
  assert.equal(settingsRouteForWorkspace("staff"), "/staff/profile");
  assert.equal(settingsRouteForWorkspace("driver"), "/driver/profile");
  assert.equal(settingsRouteForWorkspace("admin"), "/admin/platform");
});
