import { Suspense } from "react";
import { DriverCompleteInvitation } from "@/components/driver-complete-invitation";
export const metadata = { title: "Finish Driver setup · Spotly", robots: { index: false, follow: false, noarchive: true } };
export default function DriverCompletePage() {
  return <Suspense fallback={<main data-workspace="driver" className="flex min-h-screen items-center justify-center px-4"><p>Opening your secure Driver invitation…</p></main>}><DriverCompleteInvitation /></Suspense>;
}
