import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const driverMarketing = fs.readFileSync(new URL("../components/driver/driver-marketing.js", import.meta.url), "utf8");
const loginApp = fs.readFileSync(new URL("../components/login-app.js", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../app/login/page.js", import.meta.url), "utf8");
const authGate = fs.readFileSync(new URL("../components/auth-gate.js", import.meta.url), "utf8");
const customerShell = fs.readFileSync(new URL("../components/customer-shell.js", import.meta.url), "utf8");
const businessLayout = fs.readFileSync(new URL("../components/business/business-layout-client.js", import.meta.url), "utf8");
const customerMarketing = fs.readFileSync(new URL("../components/coming-soon-app.js", import.meta.url), "utf8");
const claimApp = fs.readFileSync(new URL("../components/claim-app.js", import.meta.url), "utf8");

test("portal login URLs preserve explicit sign-in versus create-account intent", async () => {
  const { spotlyLoginUrl } = await import("../lib/spotly-domains.js");
  assert.equal(
    spotlyLoginUrl("driver", { next: "/", mode: "signup" }),
    "https://driver.spotlyafrica.com/login?portal=driver&mode=signup&next=%2F"
  );
  assert.equal(
    spotlyLoginUrl("driver", { next: "/active", mode: "signin" }),
    "https://driver.spotlyafrica.com/login?portal=driver&next=%2Factive"
  );
  assert.equal(
    spotlyLoginUrl("business", { next: "/", mode: "signin" }),
    "https://business.spotlyafrica.com/login?portal=business&next=%2F"
  );
});

test("Driver acquisition CTAs do not send Start driving and Sign in through the same intent", () => {
  assert.match(driverMarketing, /const signInHref =/);
  assert.match(driverMarketing, /const applyHref =/);
  assert.match(driverMarketing, /mode: "signup"/);
  assert.match(driverMarketing, /href=\{applyHref\}>Start driving/);
  assert.match(driverMarketing, /href=\{applyHref\}>Start my Driver application/);
  assert.match(driverMarketing, /href=\{signInHref\}>Sign in/);
  assert.match(driverMarketing, /authReady && user && !user\.isAnonymous/);
});

test("login page can open directly in create-account mode and explains the Driver continuation", () => {
  assert.match(loginPage, /initialMode=\{params\?\.mode \|\| "signin"\}/);
  assert.match(loginApp, /initialMode === "signup" \? "signup" : "signin"/);
  assert.match(loginApp, /continue directly into your Driver application/);
});

test("protected portal pages have one direct sign-in action and a back-to-product escape hatch", () => {
  assert.match(authGate, /spotlyLoginUrl\(portal, \{ next, mode: "signin" \}\)/);
  assert.match(authGate, /Back to Spotly Business/);
  assert.match(authGate, /Back to Spotly Driver/);
  assert.doesNotMatch(authGate, /Learn about driving with Spotly/);
});

test("generic For businesses navigation opens the Business product landing instead of dropping into a claim form", () => {
  assert.match(customerShell, /href=\{spotlyPortalUrl\("business"\)\}>For businesses/);
});


test("interactive login cannot navigate away before the cross-domain session handshake finishes", () => {
  assert.match(loginApp, /if \(!loading && authReady && user/);
  assert.match(loginApp, /window\.location\.replace\(next\)/);
  assert.match(loginApp, /router\.replace\(next\)/);
});


test("Business get-started stays public on the clean business subdomain URL", () => {
  assert.match(businessLayout, /normalizePortalPath\("business", pathname \|\| "\/"\)/);
  assert.match(businessLayout, /cleanPathname === "\/get-started"/);
  assert.match(businessLayout, /cleanPathname\?\.startsWith\("\/claim-status\/"\)/);
});

test("customer marketing sends generic Business discovery to Spotly Business and explicit claim actions to Business get-started", () => {
  assert.match(customerMarketing, /href=\{spotlyPortalUrl\("business"\)\} action="Explore Spotly Business"/);
  assert.match(customerMarketing, /spotlyPortalUrl\("business", "\/get-started"\)/);
  assert.match(customerMarketing, /spotlyPortalUrl\("business", "\/get-started\?new=1"\)/);
  assert.match(customerMarketing, /spotlyPortalUrl\("business", `\/get-started\?business=/);
  assert.doesNotMatch(customerMarketing, /href="\/claim" action="Find my business" tone="business"/);
});

test("Business get-started keeps saved-request navigation inside the Business product", () => {
  assert.match(claimApp, /businessJourney \? spotlyPortalUrl\("business", "\/claims"\) : "\/claim\/drafts"/);
  assert.match(claimApp, /Secure account & keep my application/);
  assert.match(claimApp, /goToRequests/);
});
