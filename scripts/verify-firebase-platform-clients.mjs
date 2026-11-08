#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const customer = arg("--customer");
const driver = arg("--driver");
if (!customer || !driver) {
  console.error("Usage: node scripts/verify-firebase-platform-clients.mjs --customer /path/to/spotly --driver /path/to/spotlydriver");
  process.exit(2);
}
const failures = [];
async function requireContains(path, patterns, label) {
  try {
    const source = await readFile(path, "utf8");
    for (const pattern of patterns) if (!source.includes(pattern)) failures.push(`${label} missing ${pattern}`);
  } catch (error) { failures.push(`${label} unreadable: ${error.message}`); }
}
await requireContains(resolve(customer, "spotly.xcodeproj/project.pbxproj"), ["FirebaseFunctions", "FirebaseDatabase"], "customer Xcode project");
await requireContains(resolve(customer, "spotly/Core/Platform/FirebasePlatform.swift"), ["platformFoundation", "FirebaseFunctions", "FirebaseDatabase", "SpotlyContractMetadata.manifestSHA256", "SpotlyConfiguration.firebaseFunctionsRegion"], "customer Firebase platform client");
await requireContains(resolve(customer, "spotly/Core/Network/SpotlyConfiguration.swift"), ["firebaseFunctionsRegion = \"europe-west1\"", "spotly-africa-default-rtdb.europe-west1.firebasedatabase.app"], "customer Firebase configuration");
await requireContains(resolve(driver, "spotlydriver.xcodeproj/project.pbxproj"), ["firebase-ios-sdk", "FirebaseCore", "FirebaseFunctions", "FirebaseDatabase"], "Driver Xcode project");
await requireContains(resolve(driver, "spotlydriver/Core/Platform/DriverFirebaseBootstrap.swift"), ["spotly-africa", "com.denzeltinashe.spotlydriver"], "Driver Firebase bootstrap");
await requireContains(resolve(driver, "spotlydriver/spotlydriverApp.swift"), ["DriverFirebaseBootstrap.configureIfPossible()"], "Driver app bootstrap");
await requireContains(resolve(driver, "spotlydriver/Core/Platform/DriverFirebasePlatform.swift"), ["europe-west1", "platformFoundation", "FirebaseFunctions", "FirebaseDatabase", "SpotlyContractMetadata.manifestSHA256"], "Driver Firebase platform client");
await requireContains(resolve(driver, "spotlydriver/GoogleService-Info.plist"), ["spotly-africa", "com.denzeltinashe.spotlydriver", "spotly-africa-default-rtdb.europe-west1.firebasedatabase.app"], "Driver Firebase plist");
if (failures.length) {
  console.error(`Firebase client foundation verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Spotly Firebase client foundation verified for customer iOS + Driver iOS.");
