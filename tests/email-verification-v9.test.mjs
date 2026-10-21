import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { needsEmailVerification } from "../lib/email-verification.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("verification banner is only needed for authenticated unverified email users", () => {
  assert.equal(needsEmailVerification(null), false);
  assert.equal(needsEmailVerification({ isAnonymous: true, email: "test@example.com", emailVerified: false }), false);
  assert.equal(needsEmailVerification({ isAnonymous: false, email: "", emailVerified: false }), false);
  assert.equal(needsEmailVerification({ isAnonymous: false, email: "person@example.com", emailVerified: true }), false);
  assert.equal(needsEmailVerification({ isAnonymous: false, email: "person@example.com", emailVerified: false }), true);
  assert.equal(needsEmailVerification({ isAnonymous: false, email: "person@example.com" }), true);
});

test("verification actions send a real Firebase link and refresh the token before lifting the banner", async () => {
  const provider = await source("components/firebase-provider.js");
  const banner = await source("components/email-verification-banner.js");
  assert.match(provider, /sendVerificationEmail = useCallback/);
  assert.match(provider, /await sendEmailVerification\(current,/);
  assert.match(provider, /refreshEmailVerification = useCallback/);
  assert.match(provider, /await current\.reload\(\)/);
  assert.match(provider, /await current\.getIdToken\(true\)/);
  assert.match(provider, /verificationRevision/);
  assert.match(banner, /needsEmailVerification\(user\)/);
  assert.match(banner, /Resend verification email/);
  assert.match(banner, /I've verified/);
  assert.match(banner, /role="alert"/);
  assert.match(banner, /role="status"/);
});

test("signup does not claim verification email delivery succeeded when Firebase fails", async () => {
  const provider = await source("components/firebase-provider.js");
  const login = await source("components/login-app.js");
  assert.match(provider, /let verificationEmailSent = false/);
  assert.match(provider, /verificationEmailSent = true/);
  assert.match(provider, /return \{ user: result\.user, verificationEmailSent \}/);
  assert.match(login, /signup\.verificationEmailSent/);
  assert.doesNotMatch(login, /We also sent an email verification link/);
});

test("customer and workspace shells both show the status; anonymous visitors remain unprompted", async () => {
  for (const file of ["components/portal-shell.js", "components/customer-shell.js"]) {
    const shell = await source(file);
    assert.match(shell, /<EmailVerificationBanner\s*\/>/, file);
  }
  const rideLab = await source("app/api/mobility/ride-lab/route.js");
  assert.match(rideLab, /user\.email_verified !== true/);
});
