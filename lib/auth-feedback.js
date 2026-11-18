// Stable, non-disclosing recovery text shared across all Spotly portal logins.
export function authFeedback(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  switch (code) {
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password not recognized. Try again or reset your password.";
    case "auth/email-already-in-use": return "An account already uses this email. Sign in instead.";
    case "auth/weak-password": return "Choose a stronger password and try again.";
    case "auth/too-many-requests": return "Too many attempts. Try again later or reset your password.";
    case "auth/network-request-failed": return "Connection unavailable. Check your internet and try again.";
    case "auth/operation-not-allowed": return "This sign-in method is temporarily unavailable. Contact Spotly support.";
    default: return error?.message && !code && error.message.length <= 200
      ? error.message : "We couldn’t complete this request. Try again or contact Spotly support.";
  }
}
