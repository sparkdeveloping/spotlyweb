import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("D8 finance returns a separate, strictly verified balance projection", () => {
  const source = read("app/api/driver/payout/route.js");
  assert.match(source, /const verifiedBalances = \{/);
  assert.match(source, /USD: usdBalance\.exists \? sanitizeDriverBalance\(usdBalance\.data\(\)\) : null/);
  assert.match(source, /ZWG: zwgBalance\.exists \? sanitizeDriverBalance\(zwgBalance\.data\(\)\) : null/);
  assert.match(source, /MWK: "unsupported"/);
  assert.match(source, /supportedPayoutCurrencies: \["USD", "ZWG"\]/);
  assert.match(source, /ledgerTruncated: ledger\.size >= 500/);
  assert.match(source, /payoutsTruncated: payouts\.size >= 100/);
  assert.match(source, /entries\.filter\(\(entry\) => String\(entry\.currency \|\| ""\)\.toUpperCase\(\) === "USD"\)/);
  assert.doesNotMatch(source, /const legacy = derivedBalances\(entries\);/);
});

test("D8 payout retries cannot reserve or debit funds twice for one driver key", () => {
  const source = read("app/api/driver/payout/route.js");
  assert.match(source, /requestKey: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(source, /driver-payout:\$\{user\.uid\}:\$\{body\.requestKey\}/);
  assert.match(source, /requestHash \? transaction\.get\(payoutRef\)/);
  assert.match(source, /if \(previous\?\.exists\)/);
  assert.match(source, /original\.driverId !== user\.uid \|\| original\.currency !== body\.currency \|\| Number\(original\.amount\) !== amount/);
  assert.match(source, /replayed = true;/);
  assert.match(source, /responseStatus = String\(original\.status \|\| "requested"\)/);
  assert.match(source, /transaction\.create\(payoutRef/);
  assert.match(source, /postDriverLedgerEntry\(transaction, db/);
  assert.match(source, /reused: replayed/);
  assert.match(source, /transaction\.get\(balanceRef\)/);
});

test("D9 status and finance holds come only from authenticated Driver bootstrap", () => {
  const source = read("firebase/functions/src/core/driver-runtime.js");
  assert.match(source, /const accountReadiness = \{/);
  assert.match(source, /driverStatus: text\(driver\.status/);
  assert.match(source, /applicationStatus: text\(application\.status/);
  assert.match(source, /safetyHold: driver\.safetyHold === true/);
  assert.match(source, /complianceHold: driver\.complianceHold === true/);
  assert.match(source, /financeHold: driver\.rideFinanceHold === true \|\| driver\.sendFinanceHold === true/);
  assert.match(source, /eligible: runtimeEligibility\.eligible === true/);
  assert.match(source, /return \{ profile: profile\(actor, application, driver, selectedVehicle\), accountReadiness/);
  assert.doesNotMatch(source, /accountReadiness:.*internalNotes/);
});
