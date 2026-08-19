import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const provider = fs.readFileSync(new URL("../components/firebase-provider.js", import.meta.url), "utf8");
const sessionRoute = fs.readFileSync(new URL("../app/api/auth/session/route.js", import.meta.url), "utf8");
const bootstrapRoute = fs.readFileSync(new URL("../app/api/auth/session/bootstrap/route.js", import.meta.url), "utf8");
const sessionServer = fs.readFileSync(new URL("../lib/shared-auth-session.js", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/portal-shell.js", import.meta.url), "utf8");

test("Spotly creates a secure parent-domain session cookie after Firebase sign-in", () => {
  assert.match(provider, /persistSharedBrowserSession/);
  assert.match(provider, /\/api\/auth\/session/);
  assert.match(sessionRoute, /createSessionCookie/);
  assert.match(sessionServer, /Domain=\.spotlyafrica\.com/);
  assert.match(sessionServer, /HttpOnly/);
  assert.match(sessionServer, /SameSite=Lax/);
  assert.match(sessionServer, /Secure/);
});

test("a sibling subdomain can bootstrap its own Firebase client without asking for credentials again", () => {
  assert.match(provider, /bootstrapSharedBrowserSession/);
  assert.match(provider, /signInWithCustomToken/);
  assert.match(bootstrapRoute, /verifySessionCookie/);
  assert.match(bootstrapRoute, /createCustomToken/);
});

test("shared session endpoints are no-store and reject non-Spotly origins", () => {
  assert.match(sessionRoute, /validateSameSiteOrigin/);
  assert.match(bootstrapRoute, /validateSameSiteOrigin/);
  assert.match(sessionRoute, /Cache-Control", "no-store"/);
  assert.match(bootstrapRoute, /Cache-Control", "no-store"/);
});

test("sign out clears the shared parent-domain session before local Firebase sign-out", () => {
  assert.match(provider, /clearSharedBrowserSession/);
  assert.match(provider, /await clearSharedBrowserSession\(\);[\s\S]*await signOut/);
  assert.match(sessionRoute, /sharedSessionCookieHeader\(request, "", \{ clear: true \}\)/);
});

test("the workspace switcher uses canonical subdomain URLs", () => {
  assert.match(shell, /href=\{spotlyPortalUrl\(item\.id\)\}/);
  assert.match(shell, /resolvePortalNavigation/);
});

test("login return targets are restricted to Spotly origins or safe relative paths", async () => {
  const domains = await import("../lib/spotly-domains.js");
  assert.equal(domains.safeSpotlyDestination("https://admin.spotlyafrica.com/drivers", "/"), "https://admin.spotlyafrica.com/drivers");
  assert.equal(domains.safeSpotlyDestination("/orders", "/"), "/orders");
  assert.equal(domains.safeSpotlyDestination("https://example.com/phish", "/account"), "/account");
  assert.equal(domains.safeSpotlyDestination("javascript:alert(1)", "/account"), "/account");
});
