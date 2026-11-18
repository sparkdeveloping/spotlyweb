/** Wave D: bounded references only. No URLs, user IDs, tokens or raw error messages. */
export const DIAGNOSTIC_REFERENCE_PATTERN = /^SR-[A-F0-9]{12}$/;
export function safeDiagnosticReference(value) {
  return typeof value === "string" && DIAGNOSTIC_REFERENCE_PATTERN.test(value) ? value : null;
}
export function safeDiagnosticCode(value) {
  // The code is internal diagnostic metadata, never an untrusted server message.
  return typeof value === "string" && /^[a-z][a-z0-9_-]{0,39}$/.test(value) ? value : "internal";
}
export function safeDiagnosticClass(value) {
  return ["Error", "TypeError", "RangeError", "FirebaseError", "ZodError", "FunctionsError"].includes(value) ? value : "Other";
}
