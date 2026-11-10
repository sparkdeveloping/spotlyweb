import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root=process.cwd();
const iosRoot=process.env.SPOTLY_CUSTOMER_IOS_ROOT||process.argv[2]||"";
if(!iosRoot)throw new Error("Set SPOTLY_CUSTOMER_IOS_ROOT to the customer iOS repository.");
const files=[
 path.join(root,"contracts/spotly-customer-runtime.v1.json"),
 path.join(root,"firebase/functions/src/contracts/spotly-customer-runtime.v1.json"),
 path.join(iosRoot,"Contracts/spotly-customer-runtime.v1.json")
];
const bytes=files.map(file=>fs.readFileSync(file));
if(!bytes.every(value=>value.equals(bytes[0])))throw new Error("Customer runtime contract snapshots differ across web, Functions and customer iOS.");
const data=JSON.parse(bytes[0]);
console.log("Spotly customer runtime contract verified across web + Functions + customer iOS.");
console.log(`version=${data.customerRuntimeContractVersion}`);
console.log(`sha256=${crypto.createHash("sha256").update(bytes[0]).digest("hex")}`);
