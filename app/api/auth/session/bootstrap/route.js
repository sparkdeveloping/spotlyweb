import { getAdminServices } from "@/lib/firebase-admin";
import {
  SHARED_SIGNOUT_COOKIE,
  readCookie,
  sharedSessionCookieHeader,
  validateSameSiteOrigin
} from "@/lib/shared-auth-session";

function response(payload, init = {}) {
  const result = Response.json(payload, init);
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("Pragma", "no-cache");
  return result;
}

export async function POST(request) {
  if (!validateSameSiteOrigin(request)) return response({ ok: false, error: "Invalid authentication origin." }, { status: 403 });
  const sessionCookie = readCookie(request);
  if (!sessionCookie) return response({ ok: false, reason: readCookie(request, SHARED_SIGNOUT_COOKIE) === "1" ? "signed_out" : "missing", error: "No shared Spotly session." }, { status: 401 });

  try {
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const profileSnapshot = await db.collection("users").doc(decoded.uid).get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
    if (["suspended", "disabled"].includes(profile.status)) throw new Error("Account inactive");
    const customToken = await auth.createCustomToken(decoded.uid);
    return response({ ok: true, customToken });
  } catch {
    const result = response({ ok: false, error: "The shared Spotly session has expired." }, { status: 401 });
    result.headers.set("Set-Cookie", sharedSessionCookieHeader(request, "", { clear: true }));
    return result;
  }
}
