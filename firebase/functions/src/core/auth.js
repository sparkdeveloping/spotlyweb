import { HttpsError } from "firebase-functions/v2/https";
import { spotlyAdmin } from "./admin.js";

function permissionMatches(granted, required) {
  if (!granted || !required) return false;
  if (granted === "*" || granted === required) return true;
  const [domain] = String(required).split(".");
  return granted === `${domain}.*`;
}

export async function requireActiveAccount(request, { roles = [], permissions = [] } = {}) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const { firestore } = spotlyAdmin();
  const snapshot = await firestore.collection("users").doc(request.auth.uid).get();
  const profile = snapshot.exists ? snapshot.data() : {};
  if (["suspended", "disabled"].includes(profile.status)) {
    throw new HttpsError("permission-denied", "This Spotly account is not active.");
  }

  const userRoles = new Set(profile.roles || []);
  const userPermissions = profile.customPermissions || [];
  const superAdmin = userRoles.has("super_admin") || userPermissions.includes("*");
  if (!superAdmin && roles.length && !roles.some((role) => userRoles.has(role))) {
    throw new HttpsError("permission-denied", "Your account does not have the required role.");
  }
  if (!superAdmin && permissions.length && !permissions.every((required) => userPermissions.some((granted) => permissionMatches(granted, required)))) {
    throw new HttpsError("permission-denied", "Your account does not have the required permission.");
  }
  return { uid: request.auth.uid, token: request.auth.token, profile };
}
