import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const customerRoot = process.env.SPOTLY_CUSTOMER_IOS_ROOT ? resolve(process.env.SPOTLY_CUSTOMER_IOS_ROOT) : resolve(root, "../spotly");
const driverRoot = process.env.SPOTLY_DRIVER_IOS_ROOT ? resolve(process.env.SPOTLY_DRIVER_IOS_ROOT) : resolve(root, "../spotlydriver");
const canonical = readFileSync(resolve(root, "contracts/spotly-countries.v1.json"));
const canonicalText = canonical.toString("utf8");
const manifest = JSON.parse(canonicalText);
const hash = createHash("sha256").update(canonical).digest("hex");
const snapshots = [
  ["Functions", "firebase/functions/src/contracts/spotly-countries.v1.json"],
  ["customer iOS", resolve(customerRoot, "Contracts/spotly-countries.v1.json")],
  ["Driver iOS", resolve(driverRoot, "Contracts/spotly-countries.v1.json")]
];

for (const [label, relative] of snapshots) {
  const path = relative.startsWith?.("/") ? relative : resolve(root, relative);
  const bytes = readFileSync(path);
  const candidateHash = createHash("sha256").update(bytes).digest("hex");
  if (candidateHash !== hash) throw new Error(`${label} country snapshot is stale: ${candidateHash} != ${hash}`);
}
const generated = readFileSync(resolve(root, "lib/countries/generated.js"), "utf8");
if (!generated.includes(`SPOTLY_COUNTRY_CONTRACT_VERSION=${JSON.stringify(manifest.countryContractVersion)}`)) throw new Error("Web country binding version is stale.");
if (!generated.includes(`SPOTLY_COUNTRY_CONTRACT_SHA256=${JSON.stringify(hash)}`)) throw new Error("Web country binding hash is stale.");
for (const [label, path] of [["customer iOS", resolve(customerRoot, "spotly/Core/Contracts/SpotlyCountries.swift")], ["Driver iOS", resolve(driverRoot, "spotlydriver/Core/Contracts/SpotlyCountries.swift")]]) {
  const swift = readFileSync(path, "utf8");
  if (!swift.includes(`static let version = ${JSON.stringify(manifest.countryContractVersion)}`) || !swift.includes(`static let manifestSHA256 = ${JSON.stringify(hash)}`)) throw new Error(`${label} generated country metadata is stale.`);
}
console.log(`Spotly country catalog verified across web + Functions + customer iOS + Driver iOS.\nversion=${manifest.countryContractVersion}\nsha256=${hash}`);
