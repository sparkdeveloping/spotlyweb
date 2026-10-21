/**
 * Decide what to do with a browser-wide Spotly session without trusting a
 * temporary network failure as proof that Firebase has signed the user out.
 * A server-written signed_out tombstone is a deliberate global logout, unless
 * a new interactive sign-in is still establishing its replacement session.
 */
export function sharedSessionDecision({ localUid = "", shared = null, interactive = false, recentlyEstablished = false } = {}) {
  if (interactive || recentlyEstablished) return "wait";
  if (!localUid) return "bootstrap";
  if (shared?.ok && shared.uid === localUid) return "ready";
  if (shared?.ok && shared.uid && shared.uid !== localUid) return "switch";
  if (shared?.reason === "signed_out") return "signout";
  if (shared?.reason === "missing" || shared?.reason === "expired") return "renew";
  return "unavailable";
}
