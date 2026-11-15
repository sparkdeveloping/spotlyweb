"use client";

import { safeIncidentScreen } from "@/lib/incident-policy.mjs";

const allowedClasses = new Set(["Error", "TypeError", "NetworkError", "ChunkLoadError"]);

/** Best effort only: a failed report must never create a second render failure.
 * A reference is displayed ONLY after the backend confirms storage.
 */
export async function reportBoundaryIncident(error, surface) {
  try {
    // Lazy-load Firebase only after the error boundary itself has rendered.
    // An SDK initialization failure must not prevent global-error from mounting.
    const { publicApiFetch } = await import("@/lib/api-client");
    const digest = typeof error?.digest === "string" && /^[\w-]{1,72}$/.test(error.digest) ? error.digest : null;
    const result = await publicApiFetch("/api/public/client-incidents", {
      method: "POST", cache: "no-store", keepalive: true,
      body: JSON.stringify({
        surface,
        screen: safeIncidentScreen(typeof window !== "undefined" ? window.location.pathname : "/"),
        errorClass: allowedClasses.has(error?.name) ? error.name : "Other",
        digest,
      }),
    });
    return typeof result.incidentId === "string" && /^SI-[A-F0-9]{12}$/.test(result.incidentId)
      ? result.incidentId : null;
  } catch {
    return null;
  }
}
