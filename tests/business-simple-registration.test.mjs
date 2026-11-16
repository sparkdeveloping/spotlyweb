import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function loadRegistrationRoute() {
  const records = new Map();
  let seq = 0;

  function makeRef(docPath) {
    return {
      path: docPath,
      id: docPath.split("/").at(-1),
      get: async () => ({
        id: docPath.split("/").at(-1),
        exists: records.has(docPath),
        data: () => records.get(docPath)
      }),
      create: async (value) => {
        records.set(docPath, { ...value });
      },
      update: async (patch) => {
        const current = records.get(docPath) || {};
        records.set(docPath, { ...current, ...patch });
      },
      delete: async () => {
        records.delete(docPath);
      }
    };
  }

  const db = {
    collection(colPath) {
      let max = Infinity;
      const api = {
        doc(id) {
          return makeRef(`${colPath}/${id || `auto-${++seq}`}`);
        },
        orderBy() {
          return api;
        },
        limit(n) {
          max = n;
          return api;
        },
        add: async (value) => {
          const ref = makeRef(`${colPath}/reg-${++seq}`);
          await ref.create(value);
          return ref;
        },
        get: async () => {
          const docs = [...records.entries()]
            .filter(([key]) => key.startsWith(`${colPath}/`))
            .slice(0, max)
            .map(([key, value]) => ({
              id: key.split("/").at(-1),
              data: () => value
            }));
          return { docs, size: docs.length };
        }
      };
      return api;
    }
  };

  let source = read("app/api/public/business-registrations/route.js");
  source = source
    .replace(
      /import\s*\{\s*createHash,\s*timingSafeEqual\s*\}\s*from\s*"node:crypto";/,
      'const { createHash, timingSafeEqual } = require("node:crypto");'
    )
    .replace(
      /import\s*\{\s*FieldValue\s*\}\s*from\s*"firebase-admin\/firestore";/,
      'const { FieldValue } = require("firebase-admin/firestore");'
    )
    .replace(/import\s*\{\s*z\s*\}\s*from\s*"zod";/, 'const { z } = require("zod");')
    .replace(
      /import\s*\{\s*apiError,\s*getAdminServices,\s*verifyAppCheckRequest\s*\}\s*from\s*"@\/lib\/firebase-admin";/,
      'const { apiError, getAdminServices, verifyAppCheckRequest } = require("@/lib/firebase-admin");'
    )
    .replace(
      /import\s*\{\s*enforceRateLimit\s*\}\s*from\s*"@\/lib\/rate-limit-server";/,
      'const { enforceRateLimit } = require("@/lib/rate-limit-server");'
    )
    .replace(
      /import\s*\{\s*safeText,\s*toPlainTimestamp\s*\}\s*from\s*"@\/lib\/server-helpers";/,
      'const { safeText, toPlainTimestamp } = require("@/lib/server-helpers");'
    )
    .replace(
      /import\s*\{\s*countryCity,\s*normalizeCountryCode\s*\}\s*from\s*"@\/lib\/country-engine";/,
      'const { countryCity, normalizeCountryCode } = require("@/lib/country-engine");'
    )
    .replace(/export const (\w+)\s*=/g, "exports.$1 =")
    .replace(/export async function (\w+)/g, "exports.$1 = async function $1");

  const mocks = {
    "node:crypto": require("node:crypto"),
    zod: require("zod"),
    "firebase-admin/firestore": {
      FieldValue: { serverTimestamp: () => new Date("2026-11-16T08:00:00Z") }
    },
    "@/lib/firebase-admin": {
      verifyAppCheckRequest: async () => {},
      getAdminServices: () => ({ db }),
      apiError: (error) => Response.json({ ok: false, error: error.message }, { status: error.status || 500 })
    },
    "@/lib/rate-limit-server": {
      enforceRateLimit: async () => ({ remaining: 14 })
    },
    "@/lib/server-helpers": {
      safeText: (value, max = 500) => String(value || "").trim().slice(0, max),
      toPlainTimestamp: (value) => (value instanceof Date ? value.toISOString() : value || null)
    },
    "@/lib/country-engine": {
      normalizeCountryCode: (value) => {
        const code = String(value || "").trim().toUpperCase();
        return code === "ZW" || code === "MW" ? code : null;
      },
      countryCity: (code, city) => {
        if (code === "ZW" && String(city).toLowerCase() === "harare") return { id: "harare", name: "Harare" };
        return null;
      }
    }
  };

  const module = { exports: {} };
  const fn = new vm.Script(
    `(function(exports, require, module) { ${source} })`
  ).runInThisContext();
  fn(module.exports, (id) => mocks[id], module);
  return { route: module.exports, records };
}

test("public business registration validates and saves simplified fields", async () => {
  const { route, records } = loadRegistrationRoute();

  const badRes = await route.POST(
    new Request("http://localhost/api/public/business-registrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicantName: "Tendai Moyo",
        phone: "+263771234567",
        contactPreference: "email",
        email: "",
        businessName: "Fresh Harvest",
        registrationStatus: "in_process",
        category: "Groceries",
        country: "ZW",
        city: "Harare"
      })
    })
  );
  assert.equal(badRes.status, 400);

  const okRes = await route.POST(
    new Request("http://localhost/api/public/business-registrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicantName: "Tendai Moyo",
        phone: "+263771234567",
        email: "Tendai@Harvest.co.zw",
        roleAtBusiness: "owner",
        contactPreference: "whatsapp",
        businessName: "Fresh Harvest",
        registrationStatus: "in_process",
        category: "Groceries",
        country: "ZW",
        city: "harare",
        notes: "Best called after 2pm"
      })
    })
  );
  assert.equal(okRes.status, 201);
  const created = await okRes.json();
  assert.equal(created.ok, true);
  assert.ok(created.id);

  const stored = records.get(`businessRegistrations/${created.id}`);
  assert.equal(stored.businessName, "Fresh Harvest");
  assert.equal(stored.registrationStatus, "in_process");
  assert.equal(stored.email, "tendai@harvest.co.zw");
  assert.equal(stored.city, "Harare");
  assert.equal(stored.seen, false);
  assert.equal(stored.status, "new");
});

test("registrations admin endpoints enforce password, support seen/contacted updates and delete", async () => {
  const { route } = loadRegistrationRoute();

  await route.POST(
    new Request("http://localhost/api/public/business-registrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicantName: "Chipo Banda",
        phone: "+265991112233",
        email: "",
        roleAtBusiness: "manager",
        contactPreference: "phone",
        businessName: "Lakeview Bakery",
        registrationStatus: "not_registered",
        category: "Restaurants",
        country: "MW",
        city: "Lilongwe"
      })
    })
  );

  const unauthRes = await route.GET(
    new Request("http://localhost/api/public/business-registrations", {
      headers: { "x-registrations-password": "wrong-password" }
    })
  );
  assert.equal(unauthRes.status, 401);

  const listRes = await route.GET(
    new Request("http://localhost/api/public/business-registrations", {
      headers: { "x-registrations-password": "spotly-admin-2026" }
    })
  );
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.registrations.length, 1);
  const id = listData.registrations[0].id;
  assert.equal(listData.registrations[0].seen, false);

  const seenRes = await route.PATCH(
    new Request("http://localhost/api/public/business-registrations", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-registrations-password": "spotly-admin-2026"
      },
      body: JSON.stringify({ id, seen: true })
    })
  );
  assert.equal(seenRes.status, 200);
  const seenPayload = await seenRes.json();
  assert.equal(seenPayload.seen, true);
  assert.equal(seenPayload.status, "seen");

  const contactedRes = await route.PATCH(
    new Request("http://localhost/api/public/business-registrations", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-registrations-password": "spotly-admin-2026"
      },
      body: JSON.stringify({ id, status: "contacted" })
    })
  );
  assert.equal(contactedRes.status, 200);
  const contactedPayload = await contactedRes.json();
  assert.equal(contactedPayload.seen, true);
  assert.equal(contactedPayload.status, "contacted");

  const deleteRes = await route.DELETE(
    new Request(`http://localhost/api/public/business-registrations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-registrations-password": "spotly-admin-2026" }
    })
  );
  assert.equal(deleteRes.status, 200);

  const afterList = await route.GET(
    new Request("http://localhost/api/public/business-registrations", {
      headers: { "x-registrations-password": "spotly-admin-2026" }
    })
  );
  const afterData = await afterList.json();
  assert.equal(afterData.registrations.length, 0);
});

test("simplified onboarding UI, legacy comments, admin routes and Firestore lock are wired", () => {
  const claimApp = read("components/claim-app.js");
  assert.match(claimApp, /Register your business for Spotly/);
  assert.match(claimApp, /\/api\/public\/business-registrations/);
  assert.match(claimApp, /LEGACY 10-STEP ONBOARDING FLOW/);

  const regLib = read("lib/business-registrations.mjs");
  for (const status of ["registered", "in_process", "not_registered"]) {
    assert.ok(regLib.includes(`"${status}"`), `Missing status ${status}`);
  }

  const adminUi = read("components/simple-business-registrations-admin.js");
  assert.match(adminUi, /Mark as seen/);
  assert.match(adminUi, /Mark contacted/);
  assert.match(adminUi, /Confirm delete/);
  assert.match(adminUi, /x-registrations-password/);

  const layout = read("components/business/business-layout-client.js");
  assert.match(layout, /cleanPathname === "\/registrations"/);

  const domains = read("lib/spotly-domains.js");
  assert.match(domains, /"registrations"/);

  const rules = read("firestore.rules");
  assert.match(rules, /match \/businessRegistrations\/\{registrationId\}/);

  assert.ok(fs.existsSync(path.join(root, "app/business/registrations/page.js")));
  assert.ok(fs.existsSync(path.join(root, "app/business-registrations/page.js")));
});
