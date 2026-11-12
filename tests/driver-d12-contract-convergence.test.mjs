import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("D11 dispatch and D9 account readiness coexist in the same authenticated bootstrap",()=>{
 const s=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(s,/const dispatchReadiness = \{/);
 assert.match(s,/\.\.\.approvedTerritory\(driver, application\)/);
 assert.match(s,/const accountReadiness = \{/);
 assert.match(s,/eligible: runtimeEligibility\.eligible === true/);
 assert.match(s,/safetyHold: driver\.safetyHold === true/);
 assert.match(s,/financeHold: driver\.rideFinanceHold === true \|\| driver\.sendFinanceHold === true/);
 assert.match(s,/return \{ profile: profile\(actor, application, driver, selectedVehicle\), accountReadiness, dispatchReadiness/);
 assert.match(s,/const countryCode = action === "online" \? allowed\.country/);
 assert.match(s,/requestedCountry && requestedCountry !== allowed\.country/);
 assert.doesNotMatch(s,/includes\(result\) \? result : "ZW"/);
});

test("D6/D7 Send and Shop safeguards remain after merging readiness projections",()=>{
 const s=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(s,/routePath: \["ride", "send"\]\.includes\(kind\) && work\.quote\?\.routeSource === "verified_road_route"/);
 assert.match(s,/shopping: kind === "delivery" && work\.fulfilmentMode === "driver_shops"/);
 assert.match(s,/returnProofUploaded: kind === "send"/);
 assert.match(s,/returnProofPhotoUrl: proofPhotoUrl, returnProofUploadedAt/);
 assert.match(s,/\["start_shopping", "finish_shopping", "begin_pickup_verification", "verify_pickup"\]\.includes\(action\)/);
 assert.match(s,/kind === "send" && action === "confirm_return"/);
 assert.match(s,/Boolean\(work\.returnProofPhotoUrl \|\| proofPhotoUrl\)/);
 assert.match(s,/Boolean\(work\.proofPhotoUrl \|\| proofPhotoUrl\)/);
 assert.match(s,/patch\.cashAttestedAt = now/);
});

test("Driver finance is account-scoped, uses only verified per-currency wallets, and does not create payout on GET",()=>{
 const s=read("app/api/driver/payout/route.js");
 assert.match(s,/const user = await authenticateRequest\(request\)/);
 assert.match(s,/where\("driverId", "==", user\.uid\)/);
 assert.match(s,/const verifiedBalances = \{/);
 assert.match(s,/USD: usdBalance\.exists \? sanitizeDriverBalance\(usdBalance\.data\(\)\) : null/);
 assert.match(s,/ZWG: zwgBalance\.exists \? sanitizeDriverBalance\(zwgBalance\.data\(\)\) : null/);
 assert.match(s,/MWK: "unsupported"/);
 assert.match(s,/entries\.filter\(\(entry\) => String\(entry\.currency \|\| ""\)\.toUpperCase\(\) === "USD"\)/);
 assert.match(s,/ledgerTruncated: ledger\.size >= 500/);
 assert.match(s,/payoutsTruncated: payouts\.size >= 100/);
 assert.match(s,/return Response\.json\(\{ ok: true, balances, verifiedBalances, balanceState/);
});

test("Driver payout retries and Store receipts remain transactionally protected",()=>{
 const payout=read("app/api/driver/payout/route.js");
 const shop=read("app/api/driver/shopping/route.js");
 assert.match(payout,/requestKey: z\.string\(\)\.uuid\(\)\.optional\(\)/);
 assert.match(payout,/driver-payout:\$\{user\.uid\}:\$\{body\.requestKey\}/);
 assert.match(payout,/requestHash \? transaction\.get\(payoutRef\)/);
 assert.match(payout,/if \(previous\?\.exists\)/);
 assert.match(payout,/transaction\.create\(payoutRef/);
 assert.match(payout,/postDriverLedgerEntry\(transaction, db/);
 assert.match(payout,/responseStatus = String\(original\.status \|\| "requested"\)/);
 assert.match(shop,/validateReceiptPath\(body\.receiptStoragePath, user\.uid, body\.deliveryJobId\)/);
 assert.match(shop,/await file\.exists\(\)/);
 assert.match(shop,/await file\.getMetadata\(\)/);
 assert.match(shop,/job\.shopping\?\.checkoutAuthorizedAt/);
 assert.match(shop,/shoppingReconciliation/);
});
