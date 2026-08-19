import { getAdminServices } from "@/lib/firebase-admin";
import { apiError } from "@/lib/firebase-admin";
import {
  SHARED_SESSION_MAX_AGE_MS,
  SHARED_SIGNOUT_COOKIE,
  readCookie,
  sharedSessionCookieHeader,
  sharedSignoutCookieHeader,
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


export async function GET(request) {
  if (!validateSameSiteOrigin(request)) return noStore({ ok: false, reason: "invalid_origin", error: "Invalid authentication origin." }, { status: 403 });
  const signedOut = readCookie(request, SHARED_SIGNOUT_COOKIE) === "1";
  const sessionCookie = readCookie(request);
  if (!sessionCookie) return noStore({ ok: false, reason: signedOut ? "signed_out" : "missing" }, { status: 401 });
  try {
    const { auth } = getAdminServices();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return noStore({ ok: true, uid: decoded.uid });
  } catch {
    const result = noStore({ ok: false, reason: "expired" }, { status: 401 });
    result.headers.append("Set-Cookie", sharedSessionCookieHeader(request, "", { clear: true }));
    return result;
  }
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
    response.headers.append("Set-Cookie", sharedSessionCookieHeader(request, sessionCookie));
    response.headers.append("Set-Cookie", sharedSignoutCookieHeader(request, { clear: true }));
    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request) {
  if (!validateSameSiteOrigin(request)) return noStore({ ok: false, error: "Invalid authentication origin." }, { status: 403 });
  const response = noStore({ ok: true });
  response.headers.append("Set-Cookie", sharedSessionCookieHeader(request, "", { clear: true }));
  response.headers.append("Set-Cookie", sharedSignoutCookieHeader(request));
  return response;
}
