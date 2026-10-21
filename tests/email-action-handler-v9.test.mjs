import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EMAIL_ACTION_MODES, emailActionErrorMessage, emailActionReturnUrl } from "../lib/auth-email-actions.js";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all Firebase email template actions have matching safe operations", () => {
  assert.equal(EMAIL_ACTION_MODES.verifyEmail.operation, "VERIFY_EMAIL");
  assert.equal(EMAIL_ACTION_MODES.resetPassword.operation, "PASSWORD_RESET");
  assert.equal(EMAIL_ACTION_MODES.recoverEmail.operation, "RECOVER_EMAIL");
  assert.equal(EMAIL_ACTION_MODES.verifyAndChangeEmail.operation, "VERIFY_AND_CHANGE_EMAIL");
  assert.equal(EMAIL_ACTION_MODES.revertSecondFactorAddition.operation, "REVERT_SECOND_FACTOR_ADDITION");
  assert.equal(EMAIL_ACTION_MODES.unknown, undefined);
});

test("untrusted Firebase continue URLs cannot redirect off Spotly", () => {
  const fallback = "https://spotlyafrica.com/account";
  assert.equal(emailActionReturnUrl("verifyEmail", "https://malicious.example/"), fallback);
  assert.equal(emailActionReturnUrl("recoverEmail", "//malicious.example/"), fallback);
  assert.equal(emailActionReturnUrl("verifyEmail", "javascript:alert(1)"), fallback);
  assert.equal(emailActionReturnUrl("resetPassword", "https://badspotlyafrica.com/login"), "https://spotlyafrica.com/login");
  assert.equal(emailActionReturnUrl("verifyEmail", "https://driver.spotlyafrica.com/profile"), "https://driver.spotlyafrica.com/profile");
  assert.equal(emailActionReturnUrl("verifyEmail", "/account"), "/account");
});

test("invalid, expired and network action codes have useful public errors", () => {
  assert.match(emailActionErrorMessage({ code: "auth/expired-action-code" }), /expired|used/);
  assert.match(emailActionErrorMessage({ code: "auth/invalid-action-code" }), /expired|used/);
  assert.match(emailActionErrorMessage({ code: "auth/network-request-failed" }), /connection/);
});

test("Spotly account action performs real Firebase operations for each supported mode", async () => {
  const ui = await source("components/email-action-app.js");
  const page = await source("app/auth/action/page.js");
  assert.match(ui, /checkActionCode\(auth, code\)/);
  assert.match(ui, /info\.operation !== config\.operation/);
  assert.match(ui, /await applyActionCode\(auth, code\)/);
  assert.match(ui, /await confirmPasswordReset\(auth, code, password\)/);
  assert.match(ui, /await auth\.currentUser\.getIdToken\(true\)/);
  assert.match(ui, /mode === "resetPassword"/);
  assert.match(ui, /mode === "recoverEmail"/);
  assert.match(ui, /phase === "invalid"/);
  assert.match(page, /robots: \{ index: false, follow: false, noarchive: true \}/);
});

test("email action page prevents referrer/code leakage and enforces no-store", async () => {
  const config = await source("next.config.mjs");
  const start = config.indexOf('source: "/auth/action"');
  const end = config.indexOf('source: "/firebase-messaging-sw.js"');
  assert.ok(start >= 0 && end > start);
  assert.match(config.slice(start, end), /no-referrer/);
  assert.match(config.slice(start, end), /private, no-store/);
  assert.match(config.slice(start, end), /noindex/);
});
