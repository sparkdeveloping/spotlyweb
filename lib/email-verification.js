// Only an authenticated, non-anonymous account with an unverified email needs prompting.
// Keep this check based on Firebase Auth rather than any profile/UI-only flag.
export function needsEmailVerification(user) {
  return Boolean(user && !user.isAnonymous && String(user.email || "").trim() && user.emailVerified !== true);
}
