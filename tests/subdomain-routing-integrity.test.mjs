import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const proxy = fs.readFileSync("proxy.js", "utf8");
const domains = fs.readFileSync("lib/spotly-domains.js", "utf8");

test("production portal hostnames are explicitly mapped", () => {
  for (const [host, path] of [
    ["business.spotlyafrica.com", "/business"],
    ["admin.spotlyafrica.com", "/admin"],
    ["driver.spotlyafrica.com", "/driver"],
    ["staff.spotlyafrica.com", "/staff"]
  ]) {
    assert.match(proxy, new RegExp(host.replaceAll(".", "\\.")));
    assert.match(proxy, new RegExp(`"${path}"`));
  }
});

test("legacy apex portal paths redirect to dedicated hosts", () => {
  assert.match(proxy, /PATH_TO_HOST/);
  assert.match(proxy, /NextResponse\.redirect/);
  assert.match(proxy, /308/);
});

test("www canonicalizes to the apex customer domain", () => {
  assert.match(proxy, /www\.spotlyafrica\.com/);
  assert.match(proxy, /productionUrl\(request, "spotlyafrica\.com"\)/);
});

test("shared domain helper exposes all product surfaces", () => {
  for (const key of ["customer", "business", "admin", "driver", "staff"]) assert.match(domains, new RegExp(`${key}:`));
});
