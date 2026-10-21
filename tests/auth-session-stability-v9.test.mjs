import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sharedSessionDecision } from "../lib/auth-session-policy.js";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a transient cookie failure does not sign out valid local Firebase credentials", () => {
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: false, reason: "expired" } }), "renew");
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: false, reason: "missing" } }), "renew");
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: false, reason: "invalid_origin" } }), "unavailable");
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: null }), "unavailable");
});

test("explicit global signout remains authoritative after the transition completes", () => {
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: false, reason: "signed_out" } }), "signout");
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: false, reason: "signed_out" }, interactive: true }), "wait");
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: false, reason: "signed_out" }, recentlyEstablished: true }), "wait");
});

test("shared session is reused, or a mismatching identity switched without a logged-out flash", () => {
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: true, uid: "u1" } }), "ready");
  assert.equal(sharedSessionDecision({ localUid: "u1", shared: { ok: true, uid: "u2" } }), "switch");
  assert.equal(sharedSessionDecision({ localUid: "", shared: { ok: true, uid: "u2" } }), "bootstrap");
});

test("authenticated login waits for cross-domain session completion and does not show fields before restoration", async () => {
  const login = await read("components/login-app.js");
  assert.match(login, /authReady && sessionReady && user/);
  assert.match(login, /await ensureSharedSession\(\)/);
  assert.match(login, /!authReady \|\| redirecting \?/);
  assert.match(login, /Restoring your Spotly session/);
  assert.match(login, /setRedirecting\(true\)/);
});

test("Firebase provider fences superseded auth callbacks and avoids false signouts", async () => {
  const provider = await read("components/firebase-provider.js");
  assert.match(provider, /event !== authEventRef\.current/);
  assert.match(provider, /authEventRef\.current \+= 1/);
  assert.match(provider, /const action = sharedSessionDecision/);
  assert.match(provider, /Date\.now\(\) - sessionEstablishedAtRef\.current < 8000/);
  assert.match(provider, /if \(action === "signout"\)/);
  assert.match(provider, /if \(action === "renew"\)/);
  assert.match(provider, /setSessionReady\(true\)/);
  assert.match(provider, /setAuthReady\(false\)/);
  assert.match(provider, /interactiveAuthRef\.current/);
  assert.match(provider, /await persistSharedBrowserSession\(current, \{ required: true \}\)/);
  assert.match(provider, /sharedBootstrapAttemptedRef\.current = true/);
});

test("shared session cookie remains HttpOnly and global signout cannot be bypassed by a stale browser", async () => {
  const cookies = await read("lib/shared-auth-session.js");
  const api = await read("app/api/auth/session/route.js");
  const bootstrap = await read("app/api/auth/session/bootstrap/route.js");
  assert.match(cookies, /"HttpOnly"/);
  assert.match(cookies, /"SameSite=Lax"/);
  assert.match(api, /verifyIdToken\(idToken, true\)/);
  assert.match(api, /verifySessionCookie\(sessionCookie, true\)/);
  assert.match(bootstrap, /verifySessionCookie\(sessionCookie, true\)/);
});

test("Driver bootstrap screens never present cached data belonging to another user", async () => {
  const driver = await read("components/driver-app.js");
  assert.match(driver, /setDataUid\(user\.uid\)/);
  assert.match(driver, /identityMatches \? data : null/);
  assert.match(driver, /Signed in as/);
});
