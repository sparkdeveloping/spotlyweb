import { getAdminServices } from "@/lib/firebase-admin";
import { apiError } from "@/lib/firebase-admin";
import {
  SHARED_SESSION_MAX_AGE_MS,
  sharedSessionCookieHeader,
  validateSameSiteOrigin
} from "@/lib/shared-auth-session";

function noStore(payload, init = {}) {
  const response = Response.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function POST(request) {
  try {
    if (!validateSameSiteOrigin(request)) throw Object.assign(new Error("Invalid authentication origin."), { status: 403 });
    const idToken = bearerToken(request);
    if (!idToken) throw Object.assign(new Error("An authenticated Spotly session is required."), { status: 401 });

    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(idToken, true);
    const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
    if (["suspended", "disabled"].includes(profile.status)) throw Object.assign(new Error("This Spotly account is not active."), { status: 403 });

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SHARED_SESSION_MAX_AGE_MS });
    const response = noStore({ ok: true, expiresIn: SHARED_SESSION_MAX_AGE_MS });
    response.headers.set("Set-Cookie", sharedSessionCookieHeader(request, sessionCookie));
    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request) {
  if (!validateSameSiteOrigin(request)) return noStore({ ok: false, error: "Invalid authentication origin." }, { status: 403 });
  const response = noStore({ ok: true });
  response.headers.set("Set-Cookie", sharedSessionCookieHeader(request, "", { clear: true }));
  return response;
}
