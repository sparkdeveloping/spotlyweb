/**
 * Canonical public Firebase identity for Spotly Africa.
 *
 * These values are public Firebase Web App identifiers, not server credentials.
 * Environment variables may provide the same values at build time, but Spotly
 * intentionally refuses to run against a different Firebase project unless the
 * source is deliberately changed and reviewed.
 */
export const SPOTLY_FIREBASE_PROJECT_ID = "spotly-africa";

export const SPOTLY_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyB4RFSXLk4YAR2babx5z3ssP0E4msQ-rPE",
  authDomain: "spotly-africa.firebaseapp.com",
  projectId: SPOTLY_FIREBASE_PROJECT_ID,
  storageBucket: "spotly-africa.firebasestorage.app",
  messagingSenderId: "14197555543",
  appId: "1:14197555543:web:189486e7d4a23114c3be12",
  measurementId: "G-4FPTS9GNG9"
});
