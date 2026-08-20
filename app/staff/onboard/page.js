import { Suspense } from "react";
import { StaffOnboarding } from "@/components/staff-onboarding";

export default function StaffOnboardPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}><StaffOnboarding /></Suspense>;
}
