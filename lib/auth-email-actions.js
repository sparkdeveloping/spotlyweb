import { safeSpotlyDestination } from "./spotly-domains.js";

export const EMAIL_ACTION_MODES = Object.freeze({
  verifyEmail: { operation: "VERIFY_EMAIL", title: "Verify your email address", action: "Verify email", description: "Confirm your email address to finish securing your Spotly account." },
  resetPassword: { operation: "PASSWORD_RESET", title: "Choose a new password", action: "Update password", description: "Create a new password for your Spotly account." },
  recoverEmail: { operation: "RECOVER_EMAIL", title: "Restore your email address", action: "Restore email", description: "Review this security request and restore your previous Spotly email address." }
});

export function emailActionReturnUrl(mode, continueUrl) {
  const fallback = mode === "resetPassword" ? "https://spotlyafrica.com/login" : "https://spotlyafrica.com/account";
  // The continue URL is untrusted, even when Firebase signed the outer action code.
  return safeSpotlyDestination(continueUrl, fallback);
}

export function emailActionErrorMessage(error) {
  switch (error?.code) {
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
    case "auth/user-not-found":
      return "This link has expired or has already been used. Return to Spotly to request a new email.";
    case "auth/weak-password":
      return "Choose a stronger password with at least eight characters.";
    case "auth/network-request-failed":
      return "Spotly could not reach Firebase. Check your connection and try again.";
    default:
      return "We could not complete this request. Please try again or request a new email from Spotly.";
  }
}
