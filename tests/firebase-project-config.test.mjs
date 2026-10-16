import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Firebase client identity is pinned to the new Spotly Africa project", () => {
  const config = read("lib/firebase-project-config.js");
  assert.match(config, /SPOTLY_FIREBASE_PROJECT_ID = "spotly-africa"/);
  assert.match(config, /spotly-africa\.firebaseapp\.com/);
  assert.match(config, /spotly-africa\.firebasestorage\.app/);
  assert.match(config, /14197555543/);
  assert.match(config, /G-4FPTS9GNG9/);
});

test("Firebase messaging service worker uses the same project", () => {
  const sw = read("public/firebase-messaging-sw.js");
  assert.match(sw, /projectId: "spotly-africa"/);
  assert.match(sw, /messagingSenderId: "14197555543"/);
  assert.doesNotMatch(sw, /denzeltinashe-spotly|815870787939|G-M5DE8TVHFL/);
});

test("Firebase CLI defaults to spotly-africa", () => {
  const firebaserc = JSON.parse(read(".firebaserc"));
  assert.equal(firebaserc.projects.default, "spotly-africa");
});

test("Firebase Admin has a cross-project guard", () => {
  const admin = read("lib/firebase-admin.js");
  assert.match(admin, /Firebase Admin project mismatch/);
  assert.match(admin, /SPOTLY_FIREBASE_PROJECT_ID/);
});

test("environment template contains new client config and blank new-project server secrets", () => {
  const env = read(".env.example");
  assert.match(env, /NEXT_PUBLIC_FIREBASE_PROJECT_ID=spotly-africa/);
  assert.match(env, /NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-4FPTS9GNG9/);
  assert.match(env, /FIREBASE_ADMIN_PROJECT_ID=spotly-africa/);
  assert.match(env, /FIREBASE_ADMIN_CLIENT_EMAIL=\n/);
  assert.match(env, /FIREBASE_ADMIN_PRIVATE_KEY=\n/);
});
