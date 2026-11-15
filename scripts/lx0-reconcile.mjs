#!/usr/bin/env node
/** Inspect archive-extracted source trees; do not change source or deploy.
 * Usage: node scripts/lx0-reconcile.mjs --raw-web ... --raw-customer ...
 *     --raw-driver ... --c7-web ... --c7-customer ... --c7-driver ...
 *     --business ... --output /tmp/report.json
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
const args = Object.fromEntries(process.argv.slice(2).reduce((out, value, index, all) => {
  if (value.startsWith("--") && all[index + 1]) out.push([value.slice(2), all[index + 1]]);
  return out;
}, []));
function index(root) {
  const files = new Map();
  const ignored = new Set([".git", "node_modules", ".next", "__MACOSX", "xcuserdata", ".DS_Store"]);
  function walk(directory) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(item.name)) continue;
      const pathname = join(directory, item.name);
      if (item.isDirectory()) walk(pathname);
      else if (item.isFile()) files.set(relative(root, pathname).replaceAll("\\", "/"), createHash("sha256").update(readFileSync(pathname)).digest("hex"));
    }
  }
  walk(root); return files;
}
const required = ["raw-web", "raw-customer", "raw-driver", "c7-web", "c7-customer", "c7-driver", "business", "output"];
if (required.some(key => !args[key] || (key !== "output" && !existsSync(resolve(args[key]))))) {
  process.stderr.write(`Missing source directories/output path. Required: ${required.join(", ")}\n`);
  process.exitCode = 2;
} else {
  const comparisons = {};
  for (const [name,rawKey,baselineKey] of [
    ["web", "raw-web", "c7-web"], ["customerIOS", "raw-customer", "c7-customer"], ["driverIOS", "raw-driver", "c7-driver"]
  ]) {
    const raw = index(resolve(args[rawKey])); const staged = index(resolve(args[baselineKey]));
    comparisons[name] = {
      rawFiles: raw.size, c7Files: staged.size,
      modified: [...raw.keys()].filter(key => staged.has(key) && raw.get(key) !== staged.get(key)).sort(),
      addedByC7: [...staged.keys()].filter(key => !raw.has(key)).sort(),
      rawOnly: [...raw.keys()].filter(key => !staged.has(key)).sort()
    };
    comparisons[name].counts = Object.fromEntries(["modified", "addedByC7", "rawOnly"].map(k => [k, comparisons[name][k].length]));
  }
  const nativeManifestPath = resolve(args.business, "Backend/functions/canonical-source.json");
  let businessBackend = { checked: 0, matches: [], mismatches: [], missing: [] };
  if (existsSync(nativeManifestPath)) {
    const canonical = JSON.parse(readFileSync(nativeManifestPath, "utf8"));
    const current = index(resolve(args["c7-web"]));
    for (const [path, expected] of Object.entries(canonical.sha256 || {})) {
      businessBackend.checked++;
      if (!current.has(path)) businessBackend.missing.push(path);
      else if (current.get(path) === expected) businessBackend.matches.push(path);
      else businessBackend.mismatches.push(path);
    }
    for (const name of ["matches", "mismatches", "missing"]) businessBackend[name].sort();
  }
  const result = {
    phase: "LX0", generatedAt: new Date().toISOString(),
    source: "pre-patch raw archives compared with separate C7 staging baseline",
    deployedRevision: null, productionMergeVerified: false,
    safetyGate: "NO_GO_UNTIL_DEPLOYED_REVISION_AND_CONTRACT_TESTS_CONFIRMED",
    comparisons, businessBackend,
    warning: "A mismatched canonical source hash alone does not prove a runtime incompatibility. Do not deploy the Business iOS backend snapshot over the web Functions."
  };
  writeFileSync(resolve(args.output), JSON.stringify(result, null, 2) + "\n");
  const reduced = Object.fromEntries(Object.entries(comparisons).map(([key,value]) => [key,value.counts]));
  process.stdout.write(JSON.stringify({ sourceComparison: reduced, businessSnapshotMismatches: businessBackend.mismatches.length, productionMergeVerified: false }) + "\n");
}
