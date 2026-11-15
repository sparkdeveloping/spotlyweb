import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { routeHarness } from "./helpers/route-harness.mjs";
import {
  ATOMIC_FIXED_WINDOW_SCRIPT,
  isPublicGetQuotaEligible,
  configuredRedisUrl,
  publicQuotaKey,
  enforceAtomicPublicGetQuota,
} from "../lib/public-read-rate-limit.mjs";
import { drainExpiredQuotaPages } from "../firebase/functions/src/core/quota-retention.js";

const root = process.cwd();
const src = (file) => readFileSync(join(root, file), "utf8");
const request = (path, init = {}) => new Request(`https://spotlyafrica.com${path}`, init);

function fakeRedis() {
  const counters = new Map();
  const calls = [];
  const fetcher = async (url, args) => {
    const command = JSON.parse(args.body);
    calls.push({ url, auth: args.headers.Authorization, command });
    assert.equal(command[0], "EVAL");
    assert.equal(command[2], 1);
    const key = command[3], limit = command[4];
    const current = counters.get(key) || 0;
    if (current >= limit) return { ok: true, json: async () => ({ result: [current, 0] }) };
    counters.set(key, current + 1);
    return { ok: true, json: async () => ({ result: [current + 1, 1] }) };
  };
  return { calls, counters, fetcher };
}

const options = {
  key: "public-service-feed", limit: 2, windowMs: 60000, now: 120001,
  redisUrl: "https://spotly-test.upstash.io", redisToken: "not-real-secret"
};

test("C3: only exact public GET key/path pairs, never POST or authenticated scopes, migrate", () => {
  assert.ok(isPublicGetQuotaEligible(request("/api/public/service-feed"), { key: "public-service-feed" }));
  assert.equal(isPublicGetQuotaEligible(request("/api/public/service-feed"), { key: "public-search" }), false);
  assert.equal(isPublicGetQuotaEligible(request("/api/public/service-feed-extra"), { key: "public-service-feed" }), false);
  assert.equal(isPublicGetQuotaEligible(request("/api/public/service-feed", { method: "POST" }), { key: "public-service-feed" }), false);
  assert.equal(isPublicGetQuotaEligible(request("/api/public/service-feed"), { key: "public-service-feed", identity: "customer-1" }), false);
  assert.equal(isPublicGetQuotaEligible(request("/api/public/waitlist"), { key: "public-waitlist" }), false);
  assert.equal(isPublicGetQuotaEligible(request("/api/customer/payments"), { key: "customer-payment" }), false);
  assert.ok(src("lib/rate-limit-server.js").includes('SPOTLY_PUBLIC_GET_LIMITER === "upstash"'));
  assert.ok(src("lib/rate-limit-server.js").includes("if (error?.status === 429) throw error"));
  assert.ok(src("lib/rate-limit-server.js").includes('warnPublicLimiterFallback("distributed-unavailable")'));
});

test("C3: atomic Redis quota accepts the final allowed request then rejects without incrementing", async () => {
  const redis = fakeRedis();
  const req = request("/api/public/service-feed", { headers: { "x-forwarded-for": "203.0.113.42" } });
  const opts = { ...options, fetcher: redis.fetcher };
  assert.equal((await enforceAtomicPublicGetQuota(req, opts)).remaining, 1);
  const second = await enforceAtomicPublicGetQuota(req, opts);
  assert.equal(second.remaining, 0);
  await assert.rejects(enforceAtomicPublicGetQuota(req, opts), (error) => error.status === 429 && error.retryAfterSeconds > 0);
  assert.equal(redis.calls.length, 3);
  assert.equal(redis.counters.size, 1);
  assert.equal([...redis.counters.values()][0], 2);
  assert.equal(redis.calls[0].command[5], 119999, "expiry remains aligned to original Firestore bucket");
  assert.ok(ATOMIC_FIXED_WINDOW_SCRIPT.includes("return {used, 0}"));
  assert.ok(ATOMIC_FIXED_WINDOW_SCRIPT.includes("'PX'"));
  assert.ok(!JSON.stringify(redis.calls[0].command).includes("203.0.113.42"), "the Redis key must not expose raw IP");
  assert.equal(redis.calls[0].auth, "Bearer not-real-secret");
  assert.notEqual(
    publicQuotaKey({ key: "public-service-feed", subject: "203.0.113.42", bucket: 2, signingKey: "secret-a" }),
    publicQuotaKey({ key: "public-service-feed", subject: "203.0.113.42", bucket: 2, signingKey: "secret-b" }),
    "Redis keys must be keyed hashes, not guessable SHA256 of an IPv4 address"
  );
});

test("C3: shared server quota scope isolates keys, subjects and rolling windows", async () => {
  const redis = fakeRedis();
  const call = (ip, now) => enforceAtomicPublicGetQuota(request("/api/public/service-feed", { headers: { "x-real-ip": ip } }), { ...options, now, fetcher: redis.fetcher });
  await call("198.51.100.10", 120001);
  await call("198.51.100.11", 120001);
  await call("198.51.100.10", 180001);
  assert.equal(redis.counters.size, 3);
});

test("C3: disallow arbitrary Redis endpoints and fail rather than accepting malformed results", async () => {
  assert.equal(configuredRedisUrl("http://localhost:8888"), null);
  assert.equal(configuredRedisUrl("https://user:pw@host.example"), null);
  assert.equal(configuredRedisUrl("https://example.com/unauthorized"), null);
  assert.equal(configuredRedisUrl("https://test.example"), "https://test.example");
  const bad = async () => ({ ok: true, json: async () => ({ result: "OK" }) });
  await assert.rejects(enforceAtomicPublicGetQuota(request("/api/public/service-feed"), { ...options, fetcher: bad }), /Unexpected distributed quota response/);
  await assert.rejects(enforceAtomicPublicGetQuota(request("/api/public/service-feed"), { ...options, fetcher: async () => { throw new Error("offline"); } }), /offline/);
});

test("C3: Firestore fallback remains available when Redis is absent; other keys remain unchanged", async () => {
  const previous = process.env.SPOTLY_PUBLIC_GET_LIMITER;
  const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const warnings = [];
  const originalWarn = console.warn;
  try {
    process.env.SPOTLY_PUBLIC_GET_LIMITER = "upstash";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    console.warn = (...args) => warnings.push(args);
    const h = routeHarness(root, {
      "firebase-admin/firestore": {
        Timestamp: { fromMillis: (value) => value, now: () => Date.now() }
      }
    });
    const service = h.load("lib/rate-limit-server.js");
    const first = await service.enforceRateLimit(request("/api/public/service-feed"), { key: "public-service-feed", limit: 2, windowMs: 60000 });
    assert.equal(first.remaining, 1);
    const second = await service.enforceRateLimit(request("/api/public/service-feed"), { key: "public-service-feed", limit: 2, windowMs: 60000 });
    assert.equal(second.remaining, 0);
    await assert.rejects(service.enforceRateLimit(request("/api/public/service-feed"), { key: "public-service-feed", limit: 2, windowMs: 60000 }), (error) => error.status === 429);
    assert.equal([...h.records.keys()].filter((key) => key.startsWith("rateLimits/")).length, 1);
    assert.equal(warnings.length, 1, "failure warning should be low-volume");
    await service.enforceRateLimit(request("/api/public/waitlist", { method: "POST" }), { key: "public-waitlist", limit: 1, windowMs: 60000 });
    assert.equal([...h.records.keys()].filter((key) => key.startsWith("rateLimits/")).length, 2);
  } finally {
    console.warn = originalWarn;
    if (previous == null) delete process.env.SPOTLY_PUBLIC_GET_LIMITER; else process.env.SPOTLY_PUBLIC_GET_LIMITER = previous;
    if (prevUrl == null) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = prevUrl;
    if (prevToken == null) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = prevToken;
  }
});

test("C3: enabled public GET uses distributed limiter without Firestore writes; POST and scoped GET stay transactional", async () => {
  const before = process.env.SPOTLY_PUBLIC_GET_LIMITER;
  try {
    process.env.SPOTLY_PUBLIC_GET_LIMITER = "upstash";
    let distributedCalls = 0;
    const h = routeHarness(root, {
      "firebase-admin/firestore": { Timestamp: { fromMillis: (n) => n, now: () => Date.now() } },
      "@/lib/public-read-rate-limit.mjs": {
        isPublicGetQuotaEligible,
        enforceAtomicPublicGetQuota: async () => { distributedCalls++; return { remaining: 41, resetAt: new Date().toISOString() }; }
      }
    });
    const service = h.load("lib/rate-limit-server.js");
    assert.equal((await service.enforceRateLimit(request("/api/public/service-feed"), { key: "public-service-feed", limit: 100, windowMs: 60000 })).remaining, 41);
    assert.equal(distributedCalls, 1);
    assert.equal(h.records.size, 0);
    await service.enforceRateLimit(request("/api/public/waitlist", { method: "POST" }), { key: "public-waitlist", limit: 10, windowMs: 60000 });
    await service.enforceRateLimit(request("/api/public/service-feed"), { key: "public-service-feed", limit: 10, windowMs: 60000, identity: "authenticated-user" });
    assert.equal(distributedCalls, 1);
    assert.equal(h.records.size, 2);
  } finally {
    if (before == null) delete process.env.SPOTLY_PUBLIC_GET_LIMITER; else process.env.SPOTLY_PUBLIC_GET_LIMITER = before;
  }
});

function fakeQuotaFirestore(initialCount) {
  const records = new Map(Array.from({ length: initialCount }, (_, i) => [`quota-${i}`, { id: `quota-${i}` }]));
  const stats = { queries: 0, commits: 0, deleted: 0 };
  const firestore = {
    collection: (name) => ({ where: (field, op, cutoff) => {
      assert.equal(field, "expiresAt"); assert.equal(op, "<"); assert.ok(cutoff);
      return { limit: (pageSize) => ({ get: async () => {
        stats.queries++;
        return { docs: [...records.values()].slice(0, pageSize).map((row) => ({ ref: { id: row.id } })) };
      } }) };
    } }),
    batch: () => { const ids = []; return { delete: (ref) => ids.push(ref.id), commit: async () => { for (const id of ids) { records.delete(id); stats.deleted++; } stats.commits++; } }; }
  };
  return { firestore, records, stats };
}

test("C3: retention drains separate bounded pages, never reads whole collections", async () => {
  const h = fakeQuotaFirestore(750);
  const result = await drainExpiredQuotaPages(h.firestore, { collection: "rateLimits", cutoff: new Date(), pageSize: 200, maxPages: 3 });
  assert.deepEqual(result, { removed: 600, pages: 3, couldHaveBacklog: true });
  assert.equal(h.records.size, 150);
  assert.equal(h.stats.queries, 3);
  assert.equal(h.stats.commits, 3);
  const next = await drainExpiredQuotaPages(h.firestore, { collection: "rateLimits", cutoff: new Date(), pageSize: 200, maxPages: 3 });
  assert.deepEqual(next, { removed: 150, pages: 1, couldHaveBacklog: false });
  assert.equal(h.records.size, 0);
});

test("C3: cleanup safety clamps prohibit unbounded budgets or non-quota collections", async () => {
  const h = fakeQuotaFirestore(10);
  for (const collection of ["auditLogs", "paymentLedgers", "driverApplications"]) {
    await assert.rejects(drainExpiredQuotaPages(h.firestore, { collection, cutoff: new Date() }), /Only disposable quota/);
  }
  await assert.rejects(drainExpiredQuotaPages(h.firestore, { collection: "securityRateLimits", cutoff: new Date(), maxPages: 999 }), /Invalid quota retention budget/);
  await assert.rejects(drainExpiredQuotaPages(h.firestore, { collection: "rateLimits", cutoff: new Date(), pageSize: 450 }), /Invalid quota retention page size/);
  assert.equal(h.stats.deleted, 0);
  const retention = src("firebase/functions/src/core/retention.js");
  assert.match(retention, /securityRateLimits/);
  assert.match(retention, /Math\.min\(Math\.max/);
  assert.match(retention, /auditRetentionDays/);
  assert.match(retention, /deleteQueryBatch\(firestore, firestore\.collection\("auditLogs"\)/);
  assert.deepEqual(JSON.parse(src("firestore.indexes.json")).fieldOverrides.map((entry) => entry.collectionGroup), ["functionIdempotency"], "C3 must not silently enable production TTL");
});
