import { Suspense } from "react";
import { EmailActionApp } from "@/components/email-action-app";

export const metadata = {
  title: "Secure account action",
  description: "Verify your email, reset your password or recover your Spotly email address.",
  robots: { index: false, follow: false, noarchive: true }
};

export default function EmailActionPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[var(--grouped)] text-sm text-secondary">Loading secure account action…</main>}><EmailActionApp /></Suspense>;
}
