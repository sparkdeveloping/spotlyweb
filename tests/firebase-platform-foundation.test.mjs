import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await text(path));

test("Firebase platform declares a deployable Node 22 2nd-gen Functions + RTDB foundation", async () => {
  const [firebase, functionsPackage, indexSource] = await Promise.all([
    json("firebase.json"), json("firebase/functions/package.json"), text("firebase/functions/src/index.js")
  ]);
  assert.equal(firebase.functions.source, "firebase/functions");
  assert.equal(firebase.functions.runtime, "nodejs22");
  assert.equal(firebase.functions.codebase, "platform");
  assert.equal(firebase.database.rules, "database.rules.json");
  assert.equal(firebase.emulators.functions.port, 5001);
  assert.equal(firebase.emulators.database.port, 9000);
  assert.equal(functionsPackage.engines.node, "22");
  assert.equal(functionsPackage.dependencies["firebase-functions"], "7.4.0");
  assert.equal(functionsPackage.dependencies["firebase-admin"], "14.5.0");
  const rootPackage = await json("package.json");
  assert.match(rootPackage.scripts["firebase:deploy:platform"], /--project spotly-africa/);
  assert.match(rootPackage.scripts["firebase:deploy:functions"], /--project spotly-africa/);
  assert.match(rootPackage.scripts["firebase:deploy:platform"], /firebase-tools@15\.35\.0/);
  assert.match(rootPackage.scripts["test:emulator:platform"], /firebase-tools@15\.35\.0/);
  assert.match(indexSource, /platformFoundation/);
  assert.match(indexSource, /authenticatedFoundation/);
});

test("Functions snapshot is exactly the canonical Spotly v1 contract", async () => {
  const [canonical, snapshot] = await Promise.all([
    text("contracts/spotly-contracts.v1.json"), text("firebase/functions/src/contracts/spotly-contracts.v1.json")
  ]);
  assert.equal(snapshot, canonical);
  const hash = createHash("sha256").update(snapshot).digest("hex");
  assert.equal(hash, "753652a6e58d51dc05d11e10640e2b1adef67fe865e734b0c5af389ae735535a");
});

test("trusted mutation foundation fails closed on auth, App Check and retries", async () => {
  const [callable, auth, idempotency, rules, indexes] = await Promise.all([
    text("firebase/functions/src/core/callable.js"),
    text("firebase/functions/src/core/auth.js"),
    text("firebase/functions/src/core/idempotency.js"),
    text("firestore.rules"),
    json("firestore.indexes.json")
  ]);
  assert.match(callable, /defineTrustedMutation/);
  assert.match(callable, /enforceAppCheck:\s*true/);
  assert.match(callable, /consumeAppCheckToken:\s*false/);
  assert.match(auth, /requireActiveAccount/);
  assert.match(auth, /suspended/);
  assert.match(idempotency, /functionIdempotency/);
  assert.match(idempotency, /fingerprint/);
  assert.match(rules, /match \/functionIdempotency\/\{requestId\}/);
  const ttl = indexes.fieldOverrides.find((entry) => entry.collectionGroup === "functionIdempotency" && entry.fieldPath === "expiresAt");
  assert.equal(ttl?.ttl, true);
  assert.deepEqual(ttl?.indexes, []);
});

test("Realtime Database rules keep authorization server-owned and scope live location", async () => {
  const rules = await json("database.rules.json");
  assert.equal(rules.rules[".read"], false);
  assert.equal(rules.rules[".write"], false);
  assert.equal(rules.rules.runtimeAccess[".read"], false);
  assert.equal(rules.rules.runtimeAccess[".write"], false);
  const presence = rules.rules.driverPresence.$uid;
  assert.match(presence[".write"], /driverEligible/);
  assert.match(presence[".write"], /auth\.uid === \$uid/);
  const trip = rules.rules.activeTrips.$tripId.driverLocation;
  assert.match(trip[".write"], /runtimeAccess\/activeTrips/);
  assert.match(trip[".validate"], /driverId/);
  assert.equal(rules.rules.dispatchPresence.$country.$area.$uid[".read"], false);
  assert.match(rules.rules.dispatchPresence.$country.$area.$uid[".write"], /driverDispatchScope/);
});

test("web Firebase client exposes Functions + RTDB with explicit emulator plumbing", async () => {
  const [client, config, platform] = await Promise.all([text("lib/firebase.js"), text("lib/firebase-project-config.js"), text("lib/firebase-platform.js")]);
  assert.match(client, /getFunctions/);
  assert.match(client, /getDatabase/);
  assert.match(client, /connectFunctionsEmulator/);
  assert.match(client, /connectDatabaseEmulator/);
  assert.match(client, /callFirebaseFunction/);
  assert.match(config, /SPOTLY_FIREBASE_FUNCTIONS_REGION = "europe-west1"/);
  assert.match(config, /spotly-africa-default-rtdb\.europe-west1\.firebasedatabase\.app/);
  assert.match(platform, /SPOTLY_CONTRACT_SHA256/);
  assert.match(platform, /different contract versions/);
  assert.match(platform, /SPOTLY_FIREBASE_PROJECT_ID/);
});
