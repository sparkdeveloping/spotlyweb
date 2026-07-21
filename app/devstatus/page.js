import { DevStatusApp } from "@/components/devstatus-app";

export const metadata = {
  title: "Development status",
  description: "Client-facing Spotly product progress, current stage, open requirements, decisions, and production launch readiness."
};

export default function DevelopmentStatusPage() {
  return <DevStatusApp />;
}
