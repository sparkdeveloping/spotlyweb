import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveSpotlyHref, spotlyPortalUrl, stripPortalPrefix } from "../lib/spotly-domains.js";

const source = fs.readFileSync(new URL("../proxy.js", import.meta.url), "utf8");

test("apex and www are both served without application-level canonical redirect loops", () => {
  assert.match(source, /host === "spotlyafrica\.com" \|\| host === "www\.spotlyafrica\.com"/);
  assert.doesNotMatch(source, /host === "www\.spotlyafrica\.com"[\s\S]{0,140}NextResponse\.redirect\(productionUrl\(request, "spotlyafrica\.com"/);
});

test("legacy portal paths from any Spotly host redirect to the correct dedicated subdomain", () => {
  assert.match(source, /function portalDestination/);
  assert.match(source, /portalDestination\(pathname\)/);
  assert.match(source, /destination\.destinationHost/);
});

test("dedicated portal hosts expose clean root and section URLs", () => {
  assert.match(source, /url\.pathname = pathname === "\/" \? portalPrefix : `\$\{portalPrefix\}\$\{pathname\}`/);
  assert.equal(stripPortalPrefix("business", "/business"), "/");
  assert.equal(stripPortalPrefix("business", "/business/orders?view=new"), "/orders?view=new");
});

test("workspace switching targets product-domain roots instead of repeated portal prefixes", () => {
  assert.equal(spotlyPortalUrl("business"), "https://business.spotlyafrica.com");
  assert.equal(spotlyPortalUrl("admin", "/drivers"), "https://admin.spotlyafrica.com/drivers");
  assert.equal(resolveSpotlyHref("/admin", { currentPortal: "business" }), "https://admin.spotlyafrica.com");
  assert.equal(resolveSpotlyHref("/business/orders", { currentPortal: "business", legacyMode: false }), "/orders");
});

test("global customer destinations canonicalize to the apex while portal support stays portal-local", () => {
  assert.match(source, /CUSTOMER_HOST_PREFIXES/);
  assert.match(source, /ORIGIN_LOCAL_PREFIXES/);
  assert.doesNotMatch(source, /CUSTOMER_HOST_PREFIXES = \[[^\]]*"\/support"/s);
  assert.equal(resolveSpotlyHref("/account", { currentPortal: "business" }), "https://spotlyafrica.com/account");
  assert.equal(resolveSpotlyHref("/business/support", { currentPortal: "business", legacyMode: false }), "/support");
});

test("portal-specific login requests are sent to the portal hostname", () => {
  assert.match(source, /pathname === "\/login"/);
  assert.match(source, /request\.nextUrl\.searchParams\.get\("portal"\)/);
  assert.match(source, /loginHost/);
});
