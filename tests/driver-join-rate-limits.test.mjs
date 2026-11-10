import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DRIVER_LEAD_RATE_POLICY } from "../lib/driver-lead-rate-policy.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Driver recruitment limits individual contacts without imposing a six-person shared-IP ceiling", () => {
  assert.notEqual(DRIVER_LEAD_RATE_POLICY.contact.key, DRIVER_LEAD_RATE_POLICY.network.key);
  assert.match(DRIVER_LEAD_RATE_POLICY.contact.key, /contact-v2/);
  assert.match(DRIVER_LEAD_RATE_POLICY.network.key, /network-v2/);
  assert.equal(DRIVER_LEAD_RATE_POLICY.contact.scope, "contact");
  assert.equal(DRIVER_LEAD_RATE_POLICY.network.scope, "network");
  assert.equal(DRIVER_LEAD_RATE_POLICY.contact.windowMs, 30 * 60_000);
  assert.ok(DRIVER_LEAD_RATE_POLICY.contact.limit > 0);
  assert.ok(DRIVER_LEAD_RATE_POLICY.network.limit >= 100);
  assert.ok(DRIVER_LEAD_RATE_POLICY.network.limit > DRIVER_LEAD_RATE_POLICY.contact.limit * 20);
});

test("Driver lead endpoint validates the applicant before quota tracking and separates identity scopes", async () => {
  const source = await read("app/api/public/driver-leads/route.js");
  assert.ok(source.indexOf("schema.parse(await request.json())") < source.indexOf("enforceRateLimits(request"));
  assert.ok(source.indexOf("cleanLead(") < source.indexOf("enforceRateLimits(request"));
  assert.match(source, /contactIdentity = lead\.phone \? contactKey\("phone", lead\.phone\) : contactKey\("email", lead\.email\)/);
  assert.match(source, /\.\.\.DRIVER_LEAD_RATE_POLICY\.contact, identity: contactIdentity/);
  assert.match(source, /DRIVER_LEAD_RATE_POLICY\.network/);
  assert.doesNotMatch(source, /key: "public-driver-lead", limit: 6/);
  assert.match(source, /"Retry-After": String\(retryAfterSeconds\)/);
  assert.match(source, /status: 429/);
});

test("Grouped rate-limit checks reject atomically without consuming other applicants' network quota", async () => {
  const source = await read("lib/rate-limit-server.js");
  assert.match(source, /export async function enforceRateLimits/);
  const groupedLimiter = source.slice(source.indexOf("export async function enforceRateLimits"));
  const reads = groupedLimiter.indexOf("Promise.all(quotas.map((quota) => transaction.get(quota.ref)))");
  const rejects = groupedLimiter.indexOf("if (current >= quota.limit)");
  const writes = groupedLimiter.indexOf("transaction.set(quota.ref");
  assert.ok(reads > 0 && rejects > reads && writes > rejects, "all quota reads and quota checks must precede writes");
  assert.match(groupedLimiter, /retryAfterSeconds: quota.retryAfterSeconds/);
});

test("The Driver form displays retry information without discarding the applicant's fields", async () => {
  const source = await read("components/driver/driver-acquisition-landing.js");
  assert.match(source, /err\.status === 429/);
  assert.match(source, /err\?\.payload\?\.retryAfterSeconds/);
  assert.match(source, /Your entered details are still here/);
});
