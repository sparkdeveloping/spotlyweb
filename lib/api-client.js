import { getFirebaseAppCheckToken, getFirebaseClient } from "@/lib/firebase";

async function appCheckHeader() {
  const token = await getFirebaseAppCheckToken();
  return token ? { "X-Firebase-AppCheck": token } : {};
}

export async function publicApiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await appCheckHeader()),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "The request could not be completed.");
    error.status = response.status;
    error.payload = payload;
    if (Array.isArray(payload.blockers)) error.blockers = payload.blockers;
    throw error;
  }
  return payload;
}

export async function authenticatedFetch(url, options = {}) {
  const client = getFirebaseClient();
  // Firebase initializes asynchronously; do not report a transient startup as sign-out.
  if (client?.auth?.authStateReady && !client.auth.currentUser) await client.auth.authStateReady();
  const user = client?.auth.currentUser;
  if (!user) throw new Error("Sign in to continue.");

  async function execute(forceRefresh = false) {
    const token = await user.getIdToken(forceRefresh);
    return fetch(url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(await appCheckHeader()),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
  }

  let response = await execute(false);
  // Firebase ID tokens expire. A single forced refresh turns a stale browser session into a
  // recoverable state without blindly retrying server errors or business mutations.
  if (response.status === 401) response = await execute(true);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || (response.status === 401 ? "Your session expired. Sign in again to continue." : "The request could not be completed."));
    error.status = response.status;
    error.payload = payload;
    if (Array.isArray(payload.blockers)) error.blockers = payload.blockers;
    // Every failed user mutation has an immediately visible, fixed-position notice,
    // including Admin failures whose inline alert is far above the current scroll.
    // Read-only background polling does not generate notices.
    if (typeof window !== "undefined" && !["GET", "HEAD"].includes(String(options.method || "GET").toUpperCase())) {
      window.dispatchEvent(new CustomEvent("spotly:action-error", {
        detail: { message: error.message, status: response.status }
      }));
    }
    throw error;
  }
  return payload;
}
