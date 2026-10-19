import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("restaurant research staging is administrator-only", () => {
  const source = read("app/api/admin/assist-research/route.js");
  assert.match(source, /authenticateRequest\(request, \{ roles \}\)/);
  assert.match(source, /data_import_manager/);
  assert.match(source, /z\.literal\("ZW"\)/);
});

test("research importer never modifies actual merchant or customer commerce collections", () => {
  const source = read("app/api/admin/assist-research/route.js");
  assert.match(source, /assistResearchBatches/);
  assert.match(source, /status: "research_only"/);
  assert.match(source, /public: false/);
  assert.match(source, /priceCheckedAt: null/);
  assert.match(source, /orderable: false/);
  for (const forbidden of ["businesses", "branches", "products", "orders", "deliveryJobs", "paymentIntents"]) {
    assert.doesNotMatch(source, new RegExp("collection\\(\\\"" + forbidden + "\\\"\\)"));
  }
});

test("research import is bounded and supports non-destructive preview and stage", () => {
  const source = read("app/api/admin/assist-research/route.js");
  assert.match(source, /z\.enum\(\["preview", "stage"\]\)/);
  assert.match(source, /max\(120\)/);
  assert.match(source, /max\(300\)/);
  assert.match(source, /text\.length > 600000/);
  assert.match(source, /if \(existing\.exists\)/);
});
