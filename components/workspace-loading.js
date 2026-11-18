import { SpotlyPulseLoader } from "@/components/spotly-pulse-loader";

// Keep the existing Suspense API; only replace the full-page placeholder.
export function WorkspacePageSkeleton({ role = "business" }) {
  return <SpotlyPulseLoader tone={role === "business" || role === "driver" ? role : "primary"} label={`Opening Spotly ${role}`} />;
}
