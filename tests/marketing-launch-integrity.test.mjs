import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

test("root domain is controlled by platform launch mode instead of hardwired coming-soon content", () => {
  const page = read("app/page.js");
  const router = read("components/public-home-router.js");
  assert.match(page, /PublicHomeRouter/);
  assert.doesNotMatch(page, /ComingSoonApp/);
  assert.match(router, /publicMode/);
  assert.match(router, /marketplace/);
  assert.match(router, /private-beta/);
  assert.match(router, /maintenance/);
  assert.match(router, /router\.replace\("\/marketplace"\)/);
});

test("Admin exposes an intentional root-domain launch switch", () => {
  const admin = read("components/admin-app.js");
  assert.match(admin, /Launch marketing page/);
  assert.match(admin, /updatePublicMode/);
  assert.match(admin, /Preview root/);
  assert.match(admin, /Preview marketplace/);
});

test("marketing page is Zimbabwe-first, conversion-oriented, animated and reduced-motion aware", () => {
  const landing = read("components/coming-soon-app.js");
  for (const phrase of [
    "Built for Zimbabwe",
    "Your city. Your shops.",
    "One place to order.",
    "For Zimbabwean businesses",
    "Spotly Driver",
    "Get early access",
    "Explore Spotly",
    "CommerceDemo",
    "useReducedMotion",
    "generate_lead",
    "marketing_primary_cta",
  ]) assert.match(landing, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Marketplace has animated basket interactions and conversion analytics", () => {
  const marketplace = read("components/marketplace-app.js");
  assert.match(marketplace, /AnimatePresence/);
  assert.match(marketplace, /useReducedMotion/);
  assert.match(marketplace, /add_to_cart/);
  assert.match(marketplace, /remove_from_cart/);
  assert.match(marketplace, /begin_checkout/);
  assert.match(marketplace, /Add to basket/);
});
