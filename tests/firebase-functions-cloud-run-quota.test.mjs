import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../firebase/functions/src/index.js", import.meta.url), "utf8");
const callable = readFileSync(new URL("../firebase/functions/src/core/callable.js", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const regionCpuBudget = 20;
const maxInstancesPerFunction = 2;

function declaredCaps(source) {
  return [...source.matchAll(/\bmaxInstances:\s*(\d+)/g)].map((m) => Number(m[1]));
}

test("global and callable Firebase runtime caps stay aligned and under Cloud Run quota", () => {
  assert.deepEqual(declaredCaps(index), [maxInstancesPerFunction]);
  assert.deepEqual(declaredCaps(callable), [maxInstancesPerFunction]);
  assert.match(index, /memory:\s*"256MiB"/);
  assert.match(callable, /memory:\s*"256MiB"/);
  assert.ok(maxInstancesPerFunction < regionCpuBudget);
});

test("initial core deployment leaves CPU headroom even if every targeted function scales up", () => {
  const script = pkg.scripts["firebase:deploy:functions:core"];
  const functions = [...script.matchAll(/functions:platform:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.equal(functions.length, 7);
  assert.equal(new Set(functions).size, 7);
  // Under the 1 vCPU requested by the existing 256MiB function configuration.
  assert.ok(functions.length * maxInstancesPerFunction <= regionCpuBudget,
    "Potential core maximum exceeds 20-vCPU region budget");
});
