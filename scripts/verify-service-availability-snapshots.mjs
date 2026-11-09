import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=process.cwd();
const customerRoot=process.env.SPOTLY_CUSTOMER_IOS_ROOT?resolve(process.env.SPOTLY_CUSTOMER_IOS_ROOT):resolve(root,"../spotly");
const driverRoot=process.env.SPOTLY_DRIVER_IOS_ROOT?resolve(process.env.SPOTLY_DRIVER_IOS_ROOT):resolve(root,"../spotlydriver");
const canonical=readFileSync(resolve(root,"contracts/spotly-service-availability.v1.json"));
const manifest=JSON.parse(canonical.toString("utf8"));
const hash=createHash("sha256").update(canonical).digest("hex");
for(const [label,path] of [["Functions",resolve(root,"firebase/functions/src/contracts/spotly-service-availability.v1.json")],["customer iOS",resolve(customerRoot,"Contracts/spotly-service-availability.v1.json")],["Driver iOS",resolve(driverRoot,"Contracts/spotly-service-availability.v1.json")]]){const candidate=readFileSync(path);const candidateHash=createHash("sha256").update(candidate).digest("hex");if(candidateHash!==hash)throw new Error(`${label} service availability snapshot is stale: ${candidateHash} != ${hash}`);}
const generated=readFileSync(resolve(root,"lib/service-availability-generated.js"),"utf8");
if(!generated.includes(`SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION=${JSON.stringify(manifest.serviceAvailabilityContractVersion)}`)||!generated.includes(`SPOTLY_SERVICE_AVAILABILITY_CONTRACT_SHA256=${JSON.stringify(hash)}`))throw new Error("Web service availability binding is stale.");
for(const [label,path] of [["customer iOS",resolve(customerRoot,"spotly/Core/Contracts/SpotlyServiceAvailability.swift")],["Driver iOS",resolve(driverRoot,"spotlydriver/Core/Contracts/SpotlyServiceAvailability.swift")]]){const swift=readFileSync(path,"utf8");if(!swift.includes(`static let version = ${JSON.stringify(manifest.serviceAvailabilityContractVersion)}`)||!swift.includes(`static let manifestSHA256 = ${JSON.stringify(hash)}`))throw new Error(`${label} generated service availability metadata is stale.`);}
console.log(`Spotly service availability verified across web + Functions + customer iOS + Driver iOS.\nversion=${manifest.serviceAvailabilityContractVersion}\nsha256=${hash}`);
