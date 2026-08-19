import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../proxy.js", import.meta.url), "utf8");

test("apex and www are both served without application-level canonical redirect loops", () => {
  assert.match(source, /host === "spotlyafrica\.com" \|\| host === "www\.spotlyafrica\.com"/);
  assert.doesNotMatch(source, /host === "www\.spotlyafrica\.com"[\s\S]{0,140}NextResponse\.redirect\(productionUrl\(request, "spotlyafrica\.com"/);
});

test("legacy apex portal paths redirect to dedicated subdomains with prefix removed", () => {
  assert.match(source, /PATH_TO_HOST/);
  assert.match(source, /cleanPath/);
  assert.match(source, /destinationHost/);
});

test("dedicated portal hosts expose clean root and section URLs", () => {
  assert.match(source, /pathname === portalPrefix \|\| pathname\.startsWith/);
  assert.match(source, /url\.pathname = pathname === "\/" \? portalPrefix : `\$\{portalPrefix\}\$\{pathname\}`/);
});

test("shared API and account routes stay unprefixed on portal origins", () => {
  assert.match(source, /SHARED_PREFIXES/);
  assert.match(source, /if \(isSharedPath\(pathname\)\) return NextResponse\.next\(\)/);
});
