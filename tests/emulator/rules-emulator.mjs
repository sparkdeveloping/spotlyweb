import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadString } from "firebase/storage";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-spotly-rules";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";
const [firestoreAddress, firestorePort] = firestoreHost.split(":");
const [storageAddress, storagePort] = storageHost.split(":");

function client(name) {
  const app = initializeClientApp({ apiKey: "demo-key", authDomain: "localhost", projectId, storageBucket: `${projectId}.appspot.com` }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreAddress, Number(firestorePort));
  const storage = getStorage(app);
  connectStorageEmulator(storage, storageAddress, Number(storagePort));
  return { app, auth, db, storage };
}

async function createSignedClient(name, email) {
  const value = client(name);
  const password = "Spotly-Test-123!";
  try { await createUserWithEmailAndPassword(value.auth, email, password); }
  catch { await signInWithEmailAndPassword(value.auth, email, password); }
  return value;
}

async function allowed(promise, label) {
  try { await promise; return; } catch (error) { assert.fail(`${label} should be allowed, received ${error?.code || error}`); }
}
async function denied(promise, label) {
  try { await promise; assert.fail(`${label} should be denied`); } catch (error) {
    assert.match(String(error?.code || error), /(permission-denied|storage\/unauthorized)/, `${label} returned unexpected error ${error?.code || error}`);
  }
}

test("Firestore and Storage enforce Spotly scoped authorization", async () => {
  const adminApp = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, "rules-admin");
  const adminDb = getAdminFirestore(adminApp);
  const actors = {
    customer: await createSignedClient("rules-customer", "customer@example.com"),
    owner: await createSignedClient("rules-owner", "owner@example.com"),
    branch: await createSignedClient("rules-branch", "branch@example.com"),
    support: await createSignedClient("rules-support", "support@example.com"),
    invitee: await createSignedClient("rules-invitee", "invitee@example.com"),
    suspended: await createSignedClient("rules-suspended", "suspended@example.com"),
    outsider: await createSignedClient("rules-outsider", "outsider@example.com")
  };
  const anon = client("rules-anon");

  const uid = Object.fromEntries(Object.entries(actors).map(([key, value]) => [key, value.auth.currentUser.uid]));
  const profiles = {
    [uid.customer]: { roles: ["customer"], customPermissions: [], status: "active" },
    [uid.owner]: { roles: ["customer"], customPermissions: [], status: "active" },
    [uid.branch]: { roles: ["customer"], customPermissions: [], status: "active" },
    [uid.support]: { roles: ["support_agent"], customPermissions: ["support.*"], status: "active" },
    [uid.invitee]: { roles: ["customer"], customPermissions: [], status: "active" },
    [uid.suspended]: { roles: ["customer"], customPermissions: [], status: "suspended" },
    [uid.outsider]: { roles: ["customer"], customPermissions: [], status: "active" }
  };
  const batch = adminDb.batch();
  for (const [id, value] of Object.entries(profiles)) batch.set(adminDb.collection("users").doc(id), value);
  batch.set(adminDb.collection("organizations").doc("org1"), { name: "Org 1", ownerIds: [uid.owner] });
  batch.set(adminDb.collection("organizations").doc("org2"), { name: "Org 2", ownerIds: [] });
  batch.set(adminDb.collection("businesses").doc("biz-public"), { name: "Public", organizationId: "org1", public: true, ownerIds: [uid.owner] });
  batch.set(adminDb.collection("businesses").doc("biz-private"), { name: "Private", organizationId: "org1", public: false, ownerIds: [uid.owner] });
  batch.set(adminDb.collection("businesses").doc("biz-other"), { name: "Other", organizationId: "org2", public: false, ownerIds: [] });
  batch.set(adminDb.collection("branches").doc("branch-a"), { businessId: "biz-public", public: true, name: "A" });
  batch.set(adminDb.collection("branches").doc("branch-b"), { businessId: "biz-public", public: false, name: "B" });
  batch.set(adminDb.collection("products").doc("prod-public"), { businessId: "biz-public", published: true, active: true, name: "Milk" });
  batch.set(adminDb.collection("products").doc("prod-draft"), { businessId: "biz-public", published: false, active: true, name: "Draft" });
  batch.set(adminDb.collection("orders").doc("order-a"), { customerId: uid.customer, businessId: "biz-public", branchId: "branch-a", status: "submitted" });
  batch.set(adminDb.collection("orders").doc("order-b"), { customerId: "someone-else", businessId: "biz-public", branchId: "branch-b", status: "submitted" });
  batch.set(adminDb.collection("memberships").doc(`org1_${uid.owner}`), { organizationId: "org1", userId: uid.owner, role: "organization_owner", businessIds: ["biz-public", "biz-private"], branchIds: ["branch-a", "branch-b"], permissions: ["businesses.*", "branches.*", "catalog.*", "orders.*", "staff.*", "finance.*"], status: "active" });
  batch.set(adminDb.collection("memberships").doc(`org1_${uid.branch}`), { organizationId: "org1", userId: uid.branch, role: "branch_manager", businessIds: ["biz-public"], branchIds: ["branch-a"], permissions: ["branches.update", "orders.*", "catalog.read"], status: "active" });
  batch.set(adminDb.collection("memberships").doc(`org1_${uid.suspended}`), { organizationId: "org1", userId: uid.suspended, role: "business_manager", businessIds: ["biz-public"], branchIds: ["branch-a"], permissions: ["orders.*"], status: "active" });
  batch.set(adminDb.collection("businessInvitations").doc("invite-1"), { email: "invitee@example.com", organizationId: "org1", businessId: "biz-public", role: "business_manager", permissions: ["orders.*"], status: "pending", serverIssued: true, grantVersion: 1 });
  await batch.commit();

  await allowed(getDoc(doc(anon.db, "businesses", "biz-public")), "anonymous public business read");
  await denied(getDoc(doc(anon.db, "businesses", "biz-private")), "anonymous private business read");
  await allowed(getDocs(query(collection(anon.db, "businesses"), where("public", "==", true))), "public business query");
  await allowed(getDoc(doc(anon.db, "branches", "branch-a")), "anonymous public branch read");
  await denied(getDoc(doc(anon.db, "branches", "branch-b")), "anonymous private branch read");
  await allowed(getDoc(doc(anon.db, "products", "prod-public")), "anonymous published product read");
  await denied(getDoc(doc(anon.db, "products", "prod-draft")), "anonymous draft product read");

  await allowed(getDoc(doc(actors.customer.db, "orders", "order-a")), "customer own order read");
  await allowed(getDoc(doc(actors.branch.db, "orders", "order-a")), "branch manager assigned order read");
  await denied(getDoc(doc(actors.branch.db, "orders", "order-b")), "branch manager other branch order read");
  await denied(getDoc(doc(actors.suspended.db, "orders", "order-a")), "suspended account business order read");
  await denied(getDoc(doc(actors.support.db, "businesses", "biz-private")), "support wildcard must not become platform admin");
  await denied(updateDoc(doc(actors.branch.db, "memberships", `org1_${uid.branch}`), { role: "organization_owner" }), "membership self escalation");
  await denied(updateDoc(doc(actors.invitee.db, "businessInvitations", "invite-1"), { role: "organization_owner" }), "invite grant mutation");
  await denied(setDoc(doc(actors.outsider.db, "auditLogs", "fake-audit"), { actorId: uid.outsider, action: "fake", createdAt: new Date() }), "client audit log creation");
  await denied(setDoc(doc(actors.customer.db, "orderEvents", "fake-event"), { actorId: uid.customer, orderId: "order-a", type: "fake" }), "client order event creation");

  // The image MIME rule is tested with a data URL so authorization and MIME validation both execute.
  await allowed(uploadString(ref(actors.owner.storage, `businesses/biz-public/catalog/owner-image.png`), "data:image/png;base64,iVBORw0KGgo=", "data_url"), "owner business image upload");
  await denied(uploadString(ref(actors.branch.storage, `businesses/biz-public/catalog/branch-image.png`), "data:image/png;base64,iVBORw0KGgo=", "data_url"), "branch manager without catalogue edit upload");
  await allowed(uploadString(ref(actors.customer.storage, `support/case-1/${uid.customer}/note.txt`), "hello", "raw", { contentType: "text/plain" }), "support attachment own path");
  await denied(uploadString(ref(actors.customer.storage, `support/case-1/${uid.outsider}/note.txt`), "hello", "raw", { contentType: "text/plain" }), "support attachment other user path");

  await Promise.all([...Object.values(actors), anon].map((value) => deleteClientApp(value.app)));
  await deleteAdminApp(adminApp);
});
