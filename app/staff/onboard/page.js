import { Suspense } from "react";
import { StaffOnboarding } from "@/components/staff-onboarding";
import { WorkspacePageSkeleton } from "@/components/workspace-loading";

export default function StaffOnboardPage() {
  return <Suspense fallback={<WorkspacePageSkeleton role="staff" />}><StaffOnboarding /></Suspense>;
}
