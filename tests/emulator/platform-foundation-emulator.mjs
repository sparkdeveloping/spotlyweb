import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase, goOffline, ref, set, get } from "firebase/database";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getDatabase as getAdminDatabase } from "firebase-admin/database";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-spotly-platform";
const host = "127.0.0.1";
const permissionDenied = /PERMISSION(?:_| |-)?DENIED/i;

function firebaseConfig() {
  return {
    apiKey: "demo-key",
    authDomain: "localhost",
    projectId,
    databaseURL: `https://${projectId}.firebaseio.com`
  };
}

function functionsClient(name) {
  const app = initializeClientApp(firebaseConfig(), name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  const functions = getFunctions(app, "europe-west1");
  connectFunctionsEmulator(functions, host, 5001);
  return { app, auth, functions };
}

function databaseClient(name, uid) {
  const app = initializeClientApp(firebaseConfig(), name);
  const database = getDatabase(app);
  connectDatabaseEmulator(database, host, 9000, {
    mockUserToken: {
      sub: uid,
      user_id: uid,
      firebase: { sign_in_provider: "custom", identities: {} }
    }
  });
  return { app, database };
}

async function step(label, operation) {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${detail}`, { cause: error });
  }
}

async function expectPermissionDenied(label, operation) {
  await step(label, async () => {
    await assert.rejects(operation, (error) => {
      const detail = `${error?.code || ""} ${error?.message || error || ""}`;
      return permissionDenied.test(detail);
    });
  });
}

test("callable Functions and RTDB authorization work together in the emulator", async () => {
  const adminApp = initializeAdminApp({
    projectId,
    databaseURL: `http://${host}:9000?ns=${projectId}`
  }, "platform-admin");
  const adminDb = getAdminFirestore(adminApp);
  const adminRtdb = getAdminDatabase(adminApp);
  const driver = functionsClient("platform-driver-functions");
  const outsider = functionsClient("platform-outsider-functions");
  let driverRtdb;
  let outsiderRtdb;

  try {
    const publicResult = await step("public platformFoundation callable", () => httpsCallable(driver.functions, "platformFoundation")({}));
    assert.equal(publicResult.data.ok, true);
    assert.equal(publicResult.data.data.projectId, "spotly-africa");
    assert.equal(publicResult.data.data.contractVersion, "1.0.0");

    const credential = await step("create Driver auth-emulator user", () => createUserWithEmailAndPassword(driver.auth, "driver@example.com", "Spotly-Test-123!"));
    await step("seed Driver Firestore account", () => adminDb.collection("users").doc(credential.user.uid).set({ roles: ["customer"], status: "active", customPermissions: [] }));
    await step("seed Driver RTDB eligibility", () => adminRtdb.ref(`runtimeAccess/driverEligible/${credential.user.uid}`).set(true));
    await step("seed Driver RTDB dispatch scope", () => adminRtdb.ref(`runtimeAccess/driverDispatchScope/${credential.user.uid}/ZW/Harare`).set(true));

    const signedResult = await step("authenticatedFoundation callable", () => httpsCallable(driver.functions, "authenticatedFoundation")({}));
    assert.equal(signedResult.data.ok, true);
    assert.equal(signedResult.data.data.uid, credential.user.uid);

    const outsiderCredential = await step("create outsider auth-emulator user", () => createUserWithEmailAndPassword(outsider.auth, "outsider@example.com", "Spotly-Test-123!"));
    await step("seed outsider Firestore account", () => adminDb.collection("users").doc(outsiderCredential.user.uid).set({ roles: ["customer"], status: "active", customPermissions: [] }));

    // Security Rules are tested with explicit emulator mock tokens so the RTDB
    // checks do not depend on asynchronous Auth-token propagation inside the Web
    // SDK. The UIDs are still the real Auth-emulator UIDs used above.
    driverRtdb = databaseClient("platform-driver-rtdb", credential.user.uid);
    outsiderRtdb = databaseClient("platform-outsider-rtdb", outsiderCredential.user.uid);

    const presence = { uid: credential.user.uid, state: "online", updatedAt: Date.now(), location: { lat: -17.82, lng: 31.05 } };
    await step("Driver writes own eligible presence", () => set(ref(driverRtdb.database, `driverPresence/${credential.user.uid}`), presence));
    const ownPresence = await step("Driver reads own presence", () => get(ref(driverRtdb.database, `driverPresence/${credential.user.uid}`)));
    assert.equal(ownPresence.val().state, "online");

    await step("Driver writes authorized Zimbabwe dispatch presence", () => set(ref(driverRtdb.database, `dispatchPresence/ZW/Harare/${credential.user.uid}`), { uid: credential.user.uid, lat: -17.82, lng: 31.05, updatedAt: Date.now() }));
    await expectPermissionDenied(
      "Driver cannot write outside authorized dispatch scope",
      set(ref(driverRtdb.database, `dispatchPresence/MW/Lilongwe/${credential.user.uid}`), { uid: credential.user.uid, lat: -13.96, lng: 33.77, updatedAt: Date.now() })
    );

    await expectPermissionDenied(
      "outsider cannot overwrite another Driver presence",
      set(ref(outsiderRtdb.database, `driverPresence/${credential.user.uid}`), { ...presence, uid: outsiderCredential.user.uid })
    );

    await step("seed active-trip runtime access", () => adminRtdb.ref("runtimeAccess/activeTrips/trip_1").set({
      drivers: { [credential.user.uid]: true },
      readers: { [credential.user.uid]: true, [outsiderCredential.user.uid]: true }
    }));

    await step("authorized Driver writes active-trip location", () => set(ref(driverRtdb.database, "activeTrips/trip_1/driverLocation"), { driverId: credential.user.uid, lat: -17.82, lng: 31.05, updatedAt: Date.now() }));
    const outsiderRead = await step("authorized trip reader reads Driver location", () => get(ref(outsiderRtdb.database, "activeTrips/trip_1/driverLocation")));
    assert.equal(outsiderRead.val().driverId, credential.user.uid);

    await expectPermissionDenied(
      "trip reader cannot impersonate the Driver",
      set(ref(outsiderRtdb.database, "activeTrips/trip_1/driverLocation"), { driverId: outsiderCredential.user.uid, lat: -17.82, lng: 31.05, updatedAt: Date.now() })
    );
    await expectPermissionDenied("clients cannot read runtimeAccess", get(ref(driverRtdb.database, "runtimeAccess")));
  } finally {
    if (driverRtdb) goOffline(driverRtdb.database);
    if (outsiderRtdb) goOffline(outsiderRtdb.database);
    await Promise.all([
      deleteClientApp(driver.app),
      deleteClientApp(outsider.app),
      ...(driverRtdb ? [deleteClientApp(driverRtdb.app)] : []),
      ...(outsiderRtdb ? [deleteClientApp(outsiderRtdb.app)] : []),
      deleteAdminApp(adminApp)
    ]);
  }
});
