import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "components");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(?:js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

test("client navigation does not generate legacy product-prefixed URLs directly", () => {
  const offenders = [];
  const hrefPattern = /href=["']\/(?:business|admin|driver|staff)(?:\/|["'])/;
  const imperativePattern = /(?:router\.(?:push|replace)|window\.location\.(?:assign|replace))\(["']\/(?:business|admin|driver|staff)(?:\/|["'])/;
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, "utf8");
    if (hrefPattern.test(source) || imperativePattern.test(source)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, []);
});

test("kiosk invalid lookup input is a client error rather than a production 500", () => {
  const route = fs.readFileSync(new URL("../app/api/kiosk/lookup/route.js", import.meta.url), "utf8");
  assert.match(route, /schema\.safeParse/);
  assert.match(route, /status:\s*400/);
  assert.match(route, /Enter at least 3 characters/);
});
