import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teamRoute = fs.readFileSync("app/api/business-team/route.js", "utf8");
const claimDecisionRoute = fs.readFileSync("app/api/admin/business-claims/decision/route.js", "utf8");

test("business team invitation reads do not require the businessId+createdAt composite index", () => {
  assert.match(teamRoute, /businessInvitations"\)\.where\("businessId", "==", businessId\)\.limit\(250\)\.get\(\)/);
  assert.doesNotMatch(teamRoute, /businessInvitations"\)\.where\("businessId", "==", businessId\)\.orderBy\("createdAt"/);
  assert.match(teamRoute, /\.sort\(\(a, b\) =>/);
});

test("claim approval transaction completes membership read before its first write", () => {
  const transactionStart = claimDecisionRoute.indexOf("await db.runTransaction");
  const memberRead = claimDecisionRoute.indexOf("memberSnapshot = await transaction.get(memberRef)", transactionStart);
  const firstWrite = claimDecisionRoute.indexOf("transaction.set(claimRef", transactionStart);
  assert.ok(transactionStart >= 0);
  assert.ok(memberRead > transactionStart, "membership read should exist in transaction");
  assert.ok(firstWrite > memberRead, "membership read must happen before the first transaction write");
});
