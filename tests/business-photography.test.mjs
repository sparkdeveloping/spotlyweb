import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import dataset from "../lib/generated/open-marketplace-places.js";
import { businessPhotoFamily, businessPhotography, BUSINESS_PHOTO_FAMILIES } from "../lib/business-photography.js";
import { marketplaceMedia, marketplaceMediaSet } from "../lib/marketplace-editorial.js";
import { publicBusinessPhotoFields } from "../lib/business-photo-fields.js";

const root = new URL("../", import.meta.url);

test("all 2,101 directory businesses resolve to a real shipped photographic family", () => {
  assert.equal(dataset.records.length, 2101);
  const subjects = new Set();
  for (const record of dataset.records) {
    const media = marketplaceMedia(record);
    assert.ok(BUSINESS_PHOTO_FAMILIES[media.family], record.name);
    assert.match(media.src, new RegExp(`/marketplace/photography/${media.family}-768\\.webp$`));
    assert.equal(media.kind, "editorial");
    assert.equal(media.generated, true);
    assert.equal(media.label, "Illustrative photo");
    assert.doesNotMatch(media.src, /editorial-pack|\/editorial\//);
    subjects.add(media.family);
  }
  assert.ok(subjects.size >= 90, `${subjects.size} category subjects is too broad for this directory`);
});

test("structured category evidence beats misleading names and broad archetypes", () => {
  for (const [record, family] of [
    [{ name: "Bon Marché", sourceTags: { shop: "supermarket" } }, "supermarket"],
    [{ name: "Restaurant Shop", businessType: "restaurant_food", sourceTags: { amenity: "cafe" } }, "cafe"],
    [{ name: "Health Shop", businessType: "restaurant_food", sourceTags: { amenity: "bank" } }, "banking"],
    [{ name: "Fashion Place", sourceTags: { amenity: "fuel" } }, "fuel-station"],
    [{ name: "Beauty Shop", sourceTags: { shop: "chemist" } }, "pharmacy"],
    [{ name: "Bicycle World", sourceTags: { shop: "bicycle" } }, "bicycles"],
    [{ name: "Guest Park", sourceTags: { shop: "no", tourism: "camp_site" } }, "camping"],
    [{ name: "The Camera Cafe", sourceTags: { shop: "photo" } }, "photography"],
    [{ name: "Footwear Palace", sourceTags: { shop: "funeral_directors" } }, "funeral"],
    [{ name: "Tinashe's Sunshine City Barber and Saloon", sourceTags: { shop: "beauty" } }, "barber"],
    [{ name: "Cheese and Wine", sourceTags: { shop: "cheese" } }, "cheese-deli"]
  ]) assert.equal(businessPhotoFamily(record), family, record.name);
});

test("known food identities refine food imagery without changing a cafe, bar or non-food business", () => {
  const food = (name, cuisine = "") => ({ name, businessType: "restaurant_food", sourceTags: { amenity: "fast_food", cuisine } });
  assert.equal(businessPhotoFamily(food("Chicken Inn")), "fried-chicken");
  assert.equal(businessPhotoFamily(food("Pizza Inn")), "pizza");
  assert.equal(businessPhotoFamily(food("Nando's")), "grilled-chicken");
  assert.equal(businessPhotoFamily(food("Chicken Inn and Pizza Inn")), "takeaway");
  assert.equal(businessPhotoFamily(food("Local kitchen", "african")), "restaurant");
  assert.equal(businessPhotoFamily(food("Local kitchen", "international")), "takeaway");
  assert.equal(businessPhotoFamily({ ...food("Chicken Inn"), sourceTags: { amenity: "bar" } }), "bar");
  assert.equal(businessPhotoFamily({ ...food("Pizza Inn"), sourceTags: { shop: "supermarket" } }), "supermarket");
});

test("business pictures remain stable through sorting, pagination, repeated categories and Saved", () => {
  const records = dataset.records.filter(record => record.sourceTags.shop === "supermarket").slice(0, 12);
  for (const set of [marketplaceMediaSet(records), marketplaceMediaSet([...records].reverse()), marketplaceMediaSet(records.slice(4))]) {
    for (const [id, media] of set) assert.equal(media.src, marketplaceMedia(records.find(record => record.id === id)).src);
  }
  assert.equal(marketplaceMediaSet(records).size, records.length);
  assert.ok([...marketplaceMediaSet(records).values()].every(media => media.src));
  assert.equal(businessPhotoFamily({ title: "Saved branch", photoFamily: "pharmacy" }), "pharmacy");
});

test("approved real photos win while logos, old generics, low-resolution and mismatched evidence fall back", () => {
  const base = { id: "merchant", name: "Local grocery", category: "Groceries", source: { rightsStatus: "merchant_owned" } };
  assert.equal(marketplaceMedia({ ...base, coverImage: "https://cdn.example.com/branch.jpg" }).kind, "merchant");
  assert.equal(marketplaceMedia({ ...base, coverImage: "https://cdn.example.com/branch.jpg", imageProvenance: { width: 240, height: 160 } }).kind, "editorial");
  assert.equal(marketplaceMedia({ ...base, coverImage: "/marketplace/editorial/groceries.webp" }).kind, "editorial");
  assert.equal(marketplaceMedia({ ...base, image: businessPhotography(base).src }).kind, "editorial", "A resolved category photo stays illustrative after API serialization");
  assert.equal(marketplaceMedia({ ...base, coverImage: "https://cdn.example.com/brand.svg" }).kind, "editorial");
  assert.equal(marketplaceMedia({ ...base, coverImage: "https://cdn.example.com/logo.png", logoUrl: "https://cdn.example.com/logo.png" }).kind, "editorial");
  assert.equal(marketplaceMedia({ id: "other", coverImage: "https://cdn.example.com/branch.jpg", imageProvenance: { approved: true, businessId: "merchant", rightsStatus: "licensed" } }).kind, "editorial");
  assert.equal(marketplaceMedia({ ...base, source: { type: "openstreetmap", rightsStatus: "open_odbl" }, coverImage: "https://cdn.example.com/branch.jpg" }).kind, "editorial");
  assert.equal(marketplaceMedia({ ...base, source: { type: "openstreetmap", rightsStatus: "open_odbl" }, coverImage: "https://cdn.example.com/branch.jpg", imageProvenance: { approved: true, businessId: "merchant", rightsStatus: "licensed" } }).kind, "merchant", "A photo's own approved license does not overwrite map attribution");
  assert.equal(marketplaceMedia({ ...base, source: { type: "themenu_partner", rightsStatus: "licensed" }, coverImage: "https://firebasestorage.googleapis.com/pending.jpg" }).kind, "editorial", "A directory source label alone is not permission to publish a photo");
});

test("public media serialization preserves photo evidence without leaking unrelated fields or granting permission", () => {
  const original = { media: { cover: "https://cdn.example.com/cover.jpg", internalNotes: "private" }, imageProvenance: { businessId: "b1", approved: true, rightsStatus: "licensed", width: 1600, height: 1000, position: "60% 40%", ownerEmail: "private@example.com" }, partnerMedia: { sourceName: "The Menu", usageApproved: false, locationMatched: true, sourceUrl: "https://themenu.co.zw/place", storedUrl: "https://firebasestorage.googleapis.com/cover.jpg", usageAgreement: "private" } };
  const fields = publicBusinessPhotoFields(original);
  assert.equal(fields.media.cover, original.media.cover);
  assert.equal(fields.imageProvenance.businessId, "b1");
  assert.equal(fields.imageProvenance.width, 1600);
  assert.equal(fields.imageProvenance.position, "60% 40%");
  assert.equal(fields.partnerMedia, null, "Unapproved photo URLs remain private");
  assert.doesNotMatch(JSON.stringify(fields), /themenu\.co\.zw|firebasestorage/);
  const licensed = { ...original, source: { type: "themenu_partner", rightsStatus: "licensed" }, partnerMedia: { ...original.partnerMedia, usageApproved: true } };
  const published = publicBusinessPhotoFields(licensed);
  assert.equal(published.partnerMedia.storedUrl, original.partnerMedia.storedUrl);
  assert.equal(marketplaceMedia({ id: "b1", ...licensed, ...published }).kind, "licensed-directory");
  assert.doesNotMatch(JSON.stringify(fields), /private|ownerEmail|usageAgreement|internalNotes/);
  assert.equal(publicBusinessPhotoFields({}).imageProvenance.approved, false);
  assert.equal(publicBusinessPhotoFields({ imageProvenance: { position: "999% 40%" } }).imageProvenance.position, "50% 50%");
});

test("every generated subject ships responsive photographic files within image transfer budgets", async () => {
  let total = 0;
  for (const family of Object.keys(BUSINESS_PHOTO_FAMILIES)) {
    for (const [width, budget] of [[320, 35000], [768, 125000], [1536, 600000]]) {
      const path = `public/marketplace/photography/${family}-${width}.webp`;
      const data = await readFile(new URL(path, root));
      const meta = await sharp(data).metadata();
      assert.equal(meta.width, width, path);
      assert.equal(meta.hasAlpha, false, path);
      assert.ok(meta.width / meta.height > 1.49 && meta.width / meta.height < 1.51, path);
      assert.ok(data.length < budget, `${path} is ${data.length} bytes`);
      total += data.length;
    }
  }
  assert.ok(total < 40_000_000, `Photo family totals ${total} bytes`);
});
