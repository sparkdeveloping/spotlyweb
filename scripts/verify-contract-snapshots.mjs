#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const customerRoot = arg("--customer");
const driverRoot = arg("--driver");
if (!customerRoot || !driverRoot) {
  console.error("Usage: node scripts/verify-contract-snapshots.mjs --customer /path/to/spotly --driver /path/to/spotlydriver");
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const canonicalPath = resolve(root, "contracts/spotly-contracts.v1.json");
const canonicalBytes = await readFile(canonicalPath);
const canonicalHash = createHash("sha256").update(canonicalBytes).digest("hex");
const canonical = JSON.parse(canonicalBytes);

const backendTargets = [
  { name: "Functions backend", snapshot: resolve(root, "firebase/functions/src/contracts/spotly-contracts.v1.json") }
];

const targets = [
  {
    name: "customer iOS",
    snapshot: resolve(customerRoot, "Contracts/spotly-contracts.v1.json"),
    swift: resolve(customerRoot, "spotly/Core/Contracts/SpotlyContracts.swift")
  },
  {
    name: "Driver iOS",
    snapshot: resolve(driverRoot, "Contracts/spotly-contracts.v1.json"),
    swift: resolve(driverRoot, "spotlydriver/Core/Contracts/SpotlyContracts.swift")
  }
];

const failures = [];
for (const target of backendTargets) {
  try {
    const snapshotBytes = await readFile(target.snapshot);
    const snapshotHash = createHash("sha256").update(snapshotBytes).digest("hex");
    if (snapshotHash !== canonicalHash) failures.push(`${target.name} snapshot hash ${snapshotHash} != canonical ${canonicalHash}`);
    const snapshot = JSON.parse(snapshotBytes);
    if (snapshot.contractVersion !== canonical.contractVersion) failures.push(`${target.name} snapshot version ${snapshot.contractVersion} != canonical ${canonical.contractVersion}`);
  } catch (error) {
    failures.push(`${target.name} snapshot unreadable: ${error.message}`);
  }
}
for (const target of targets) {
  try {
    const snapshotBytes = await readFile(target.snapshot);
    const snapshotHash = createHash("sha256").update(snapshotBytes).digest("hex");
    if (snapshotHash !== canonicalHash) failures.push(`${target.name} snapshot hash ${snapshotHash} != canonical ${canonicalHash}`);
    const snapshot = JSON.parse(snapshotBytes);
    if (snapshot.contractVersion !== canonical.contractVersion) failures.push(`${target.name} snapshot version ${snapshot.contractVersion} != canonical ${canonical.contractVersion}`);
  } catch (error) {
    failures.push(`${target.name} snapshot unreadable: ${error.message}`);
  }
  try {
    const swift = await readFile(target.swift, "utf8");
    if (!swift.includes(`manifestSHA256 = "${canonicalHash}"`)) failures.push(`${target.name} generated Swift binding does not advertise canonical hash ${canonicalHash}`);
    if (!swift.includes(`version = "${canonical.contractVersion}"`)) failures.push(`${target.name} generated Swift binding does not advertise version ${canonical.version}`);
  } catch (error) {
    failures.push(`${target.name} Swift binding unreadable: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Spotly contract snapshot verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Spotly canonical contracts verified across web + Functions + customer iOS + Driver iOS.`);
console.log(`version=${canonical.contractVersion}`);
console.log(`sha256=${canonicalHash}`);
