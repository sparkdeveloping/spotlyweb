import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const notificationServer = fs.readFileSync("lib/notification-server.js", "utf8");
const notificationCenter = fs.readFileSync("components/notification-center.js", "utf8");
const portalShell = fs.readFileSync("components/portal-shell.js", "utf8");
const accountApp = fs.readFileSync("components/account-app.js", "utf8");
const workspaces = fs.readFileSync("lib/workspaces.js", "utf8");
const firebaseProvider = fs.readFileSync("components/firebase-provider.js", "utf8");
const branchesRoute = fs.readFileSync("app/api/business/branches/route.js", "utf8");
const claimDecision = fs.readFileSync("app/api/admin/business-claims/decision/route.js", "utf8");
const driverAdmin = fs.readFileSync("app/api/admin/drivers/route.js", "utf8");

test("operational notifications persist in-app and support push plus transactional email", () => {
  assert.match(notificationServer, /db\.collection\("notifications"\)\.doc\(\)/);
  assert.match(notificationServer, /pushTokens/);
  assert.match(notificationServer, /https:\/\/api\.resend\.com\/emails/);
  assert.match(notificationServer, /forceOperationalEmail/);
  assert.match(notificationServer, /workspace:/);
  assert.match(notificationServer, /module:/);
  assert.match(notificationServer, /eventType:/);
  assert.match(notificationServer, /staffProfiles/);
  assert.match(notificationServer, /rolePackId/);
});

test("review activity uses the canonical notification dispatcher", () => {
  assert.match(branchesRoute, /eventType: "location_review\.submitted"/);
  assert.match(claimDecision, /notifyUser/);
  assert.match(driverAdmin, /notifyUsers/);
});

test("global notification tray and module notification center are both available", () => {
  assert.match(portalShell, /title="Notifications"/);
  assert.match(portalShell, /filter === "workspace"/);
  assert.match(portalShell, /filter === "reviews"/);
  assert.match(portalShell, /attentionNotification/);
  assert.match(notificationCenter, /All \(\$\{scoped\.length\}\)/);
  assert.match(notificationCenter, /Reviews \(\$\{scoped\.filter\(isReviewNotification\)\.length\}\)/);
});

test("account gateway is customer-first and super admins receive every workspace", () => {
  assert.match(workspaces, /new Set\(\["customer"\]\)/);
  assert.match(workspaces, /roles\.has\("super_admin"\)/);
  assert.match(workspaces, /\["business", "driver", "staff", "admin"\]/);
  assert.match(accountApp, /Customer/);
  assert.match(accountApp, /Where do you want to go\?/);
  assert.match(firebaseProvider, /staffProfiles/);
  assert.match(firebaseProvider, /driverApplications/);
  assert.match(firebaseProvider, /drivers/);
});

test("workspace switcher iterates the Set returned by workspaceAccess", () => {
  assert.match(portalShell, /return \[\.\.\.access\]\.map/);
  assert.doesNotMatch(portalShell, /Object\.entries\(access\)/);
});
