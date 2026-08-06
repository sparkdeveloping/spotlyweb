import { Suspense } from "react";
import { SupportApp } from "@/components/support-app";

export const metadata = { title: "Help and support", description: "Practical Spotly guides and support conversations." };

export default function SupportPage() {
  return <Suspense fallback={<main className="min-h-screen bg-grouped" />}><SupportApp /></Suspense>;
}
