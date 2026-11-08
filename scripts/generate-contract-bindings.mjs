import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "contracts", "spotly-contracts.v1.json");
const raw = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(raw);
const hash = createHash("sha256").update(raw).digest("hex");
const enums = manifest["x-spotly-enums"];
if (!manifest.contractVersion || !enums) throw new Error("Contract manifest is missing version/enums.");

const js = `// GENERATED from contracts/spotly-contracts.v1.json. Do not edit by hand.\n` +
`export const SPOTLY_CONTRACT_VERSION = ${JSON.stringify(manifest.contractVersion)};\n` +
`export const SPOTLY_CONTRACT_SHA256 = ${JSON.stringify(hash)};\n` +
Object.entries(enums).map(([key, values]) => {
  const name = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  return `export const ${name} = Object.freeze(${JSON.stringify(values)});`;
}).join("\n") + "\n";
await mkdir(path.join(root, "lib", "contracts"), { recursive: true });
await writeFile(path.join(root, "lib", "contracts", "generated.js"), js);
await mkdir(path.join(root, "firebase", "functions", "src", "contracts"), { recursive: true });
await writeFile(path.join(root, "firebase", "functions", "src", "contracts", "spotly-contracts.v1.json"), raw);

const swiftEnum = (name, values, opts = {}) => {
  const cases = values.map((value) => {
    let caseName = value.replace(/[^A-Za-z0-9]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/^[0-9]/, "_$&");
    if (caseName === "repeat") caseName = "repeatValue";
    return `    case ${caseName} = ${JSON.stringify(value)}`;
  }).join("\n");
  return `nonisolated enum ${name}: String, CaseIterable, Codable, Hashable, Sendable {\n${cases}\n}\n`;
};

const swift = `// GENERATED from Spotly Web contracts/spotly-contracts.v1.json. Do not edit by hand.\n` +
`import Foundation\n\n` +
`nonisolated enum SpotlyContractMetadata {\n    static let version = ${JSON.stringify(manifest.contractVersion)}\n    static let manifestSHA256 = ${JSON.stringify(hash)}\n}\n\n` +
swiftEnum("SpotlyServiceID", enums.serviceIds) + `\n` +
swiftEnum("SpotlyCountryCode", enums.countryCodes) + `\n` +
swiftEnum("SpotlyCurrencyCode", enums.currencyCodes) + `\n` +
swiftEnum("SpotlyActivityKind", enums.activityKinds) + `\n` +
swiftEnum("SpotlyTransactionKind", enums.transactionKinds) + `\n` +
swiftEnum("SpotlyDriverWorkType", enums.driverWorkTypes) + `\n` +
swiftEnum("SpotlyRideServiceTypeID", enums.rideServiceTypes) + `\n` +
swiftEnum("SpotlyParcelSize", enums.parcelSizes) + `\n` +
swiftEnum("SpotlyPaymentMethod", enums.paymentMethods) + `\n` +
swiftEnum("SpotlyPaymentState", enums.paymentStatuses) + `\n` +
swiftEnum("SpotlyPrimaryAction", enums.primaryActions) + `\n` +
swiftEnum("SpotlyPickupMode", enums.pickupModes) + `\n` +
`typealias SpotlyServiceKind = SpotlyServiceID\n\n` +
`nonisolated struct SpotlyMoney: Codable, Hashable, Sendable {\n    let amount: Double\n    let currency: SpotlyCurrencyCode\n}\n\n` +
`nonisolated struct SpotlyLocationPoint: Codable, Hashable, Sendable {\n    let lat: Double\n    let lng: Double\n    let accuracy: Double?\n    let country: SpotlyCountryCode\n    let label: String?\n    let formattedAddress: String?\n    let area: String?\n    let city: String?\n\n    init(lat: Double, lng: Double, accuracy: Double? = nil, country: SpotlyCountryCode, label: String? = nil, formattedAddress: String? = nil, area: String? = nil, city: String? = nil) {\n        self.lat = lat\n        self.lng = lng\n        self.accuracy = accuracy\n        self.country = country\n        self.label = label\n        self.formattedAddress = formattedAddress\n        self.area = area\n        self.city = city\n    }\n}\n\n` +
`nonisolated struct SpotlyQuoteLock: Codable, Hashable, Sendable {\n    let quotedTotal: Double\n    let quotedCurrency: SpotlyCurrencyCode\n}\n\n` +
`nonisolated struct SpotlyAPIErrorEnvelope: Codable, Hashable, Sendable {\n    let ok: Bool\n    let error: String\n    let code: String?\n    let retryable: Bool?\n}\n\n` +
`nonisolated struct SpotlyDriverWorkOfferContract: Codable, Hashable, Sendable {\n    let id: String\n    let workType: SpotlyDriverWorkType\n    let state: String\n    let currency: SpotlyCurrencyCode\n    let estimatedEarnings: Double\n    let pickup: SpotlyLocationPoint?\n    let dropoff: SpotlyLocationPoint?\n    let expiresAt: String?\n}\n`;

function cliValue(...names) {
  for (const name of names) {
    const equals = process.argv.find((value) => value.startsWith(`${name}=`));
    if (equals) return equals.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) return process.argv[index + 1];
  }
  return null;
}

const customerOut = process.env.SPOTLY_CUSTOMER_SWIFT_OUT || cliValue("--customer", "--customer-swift");
const driverOut = process.env.SPOTLY_DRIVER_SWIFT_OUT || cliValue("--driver", "--driver-swift");
for (const out of [customerOut, driverOut].filter(Boolean)) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, swift);
}
console.log(`Generated Spotly contracts v${manifest.contractVersion} (${hash.slice(0, 12)}).`);
