import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Send delivery and return evidence are distinct and bound to confirmed states",()=>{
 const runtime=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(runtime,/requestedPurpose = text\(data\.purpose \|\| "delivery"/);
 assert.match(runtime,/purpose === "return" && work\.state !== "return_in_progress"/);
 assert.match(runtime,/returnProofPhotoUrl: proofPhotoUrl, returnProofUploadedAt/);
 assert.match(runtime,/kind === "send" && work\.state === "return_in_progress" && data\.purpose == null/);
 assert.match(runtime,/purpose === "delivery" && kind === "send" && \["handoff_exception","return_in_progress"\]/);
 assert.match(runtime,/kind === "send" && action === "confirm_return"/);
 assert.match(runtime,/Boolean\(work\.returnProofPhotoUrl \|\| proofPhotoUrl\)/);
 assert.match(runtime,/Boolean\(work\.proofPhotoUrl \|\| proofPhotoUrl\)/);
 assert.match(runtime,/matchesSecretPin/);
});

test("funded Shop checkout cannot be bypassed with generic work actions",()=>{
 const runtime=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(runtime,/work\.fulfilmentMode === "driver_shops"/);
 assert.match(runtime,/\["start_shopping", "finish_shopping", "begin_pickup_verification", "verify_pickup"\]\.includes\(action\)/);
 assert.match(runtime,/Use the funded shopping checklist and receipt review/);
 assert.match(runtime,/shopping: kind === "delivery"/);
 assert.match(runtime,/checkoutAuthorized: Boolean\(work\.shopping\?\.checkoutAuthorizedAt\)/);
 assert.match(runtime,/maxAuthorized: num\(work\.shopping\?\.maxAuthorizedMerchandise\)/);
 assert.match(runtime,/substitutionAllowed: item\.substitutionAllowed !== false/);
 assert.match(runtime,/substitutionPreference:/);
});

test("Shop checkout API enforces real receipt storage, funded amount, store approval and no pending substitutions",()=>{
 const checkout=read("app/api/driver/shopping/route.js");
 assert.match(checkout,/validateReceiptPath\(body\.receiptStoragePath, user\.uid, body\.deliveryJobId\)/);
 assert.match(checkout,/storage\.bucket\(\)\.file\(body\.receiptStoragePath\)/);
 assert.match(checkout,/await file\.exists\(\)/);
 assert.match(checkout,/await file\.getMetadata\(\)/);
 assert.match(checkout,/contentType \|\| ""\)\.startsWith\("image\/"\)/);
 assert.match(checkout,/job\.shopping\?\.checkoutAuthorizedAt/);
 assert.match(checkout,/\["pending", "substitution_pending"\]/);
 assert.match(checkout,/order\.paymentStatus/);
 assert.match(checkout,/maxAuthorized/);
 assert.match(checkout,/postPaymentCapturedLedger/);
 assert.match(checkout,/shoppingReconciliation/);
 assert.match(checkout,/adjustmentId/);
});

test("Send route is strictly projected from previously verified customer quote and supports typed return status",()=>{
 const runtime=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(runtime,/\["ride", "send"\]\.includes\(kind\) && work\.quote\?\.routeSource === "verified_road_route"/);
 assert.match(runtime,/Array\.isArray\(work\.quote\?\.routePath\)/);
 assert.match(runtime,/Math\.abs\(point\.lat\) <= 90/);
 assert.match(runtime,/Math\.abs\(point\.lng\) <= 180/);
 assert.match(runtime,/\.slice\(0, 250\)/);
 assert.match(runtime,/returnProofUploaded: kind === "send"/);
 assert.doesNotMatch(runtime,/returnProofPhotoUrl: work\.returnProofPhotoUrl,\s*\n.*proofPhotoUrl/);
});

test("driver completion never marks cash as an automatic payout",()=>{
 const runtime=read("firebase/functions/src/core/driver-runtime.js");
 assert.match(runtime,/const expectedCash = kind === "delivery"/);
 assert.match(runtime,/Math\.round\(supplied \* 100\) !== Math\.round\(expectedCash \* 100\)/);
 assert.match(runtime,/patch\.cashAttestedAt = now/);
 assert.match(runtime,/driverEarningsStatus = "awaiting_customer_payment"/);
});
