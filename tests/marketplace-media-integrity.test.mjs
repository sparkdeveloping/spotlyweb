import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { marketplaceMedia, marketplaceMediaSet } from "../lib/marketplace-editorial.js";

test("merchant-owned business photography wins over the generated family", () => {
  const media = marketplaceMedia({ id: "ok", name: "OK Zimbabwe", category: "Groceries", coverImage: "https://cdn.example.com/branch.jpg", source: { rightsStatus: "merchant_owned" } });
  assert.equal(media.src, "https://cdn.example.com/branch.jpg");
  assert.equal(media.kind, "merchant");
  assert.equal(media.generated, false);
});
test("unclaimed business types have appropriate shipped pictures, including specialist shops", () => {
  for (const [record, family] of [[{ category: "Restaurants", sourceTags: { amenity: "cafe" } }, "cafe"], [{ category: "Groceries", sourceTags: { shop: "supermarket" } }, "supermarket"], [{ category: "Pharmacy" }, "pharmacy"]]) {
    const media = marketplaceMedia(record);
    assert.equal(media.family, family);
    assert.equal(media.kind, "editorial");
    assert.ok(existsSync(new URL(`../public${media.src}`, import.meta.url)), media.src);
  }
});
test("repeated business categories retain pictures rather than becoming blank cards", () => {
  const records = ["A", "B", "C", "D", "E", "F"].map(id => ({ id, category: "Restaurants" }));
  const assigned = marketplaceMediaSet(records);
  assert.equal(assigned.size, 6);
  assert.ok(records.every(record => assigned.get(record.id).src === marketplaceMedia(record).src));
});
test("all customer business surfaces share picture selection, disclosure and failure recovery", () => {
  for (const path of ["components/service-experience.js", "components/marketplace-home.js", "components/marketplace-app.js", "components/customer-utility.js", "components/coming-soon-app.js"]) {
    assert.match(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), /BusinessPhoto/, path);
  }
  const component = readFileSync(new URL("../components/business-photo.js", import.meta.url), "utf8");
  assert.match(component, /Illustrative photo/);
  assert.match(component, /not a photograph of this specific business or branch/);
  assert.match(component, /onError/);
});
