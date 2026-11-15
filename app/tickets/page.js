import { Suspense } from "react";
import { TicketsApp } from "@/components/tickets-app";

export const metadata = {
  title: "Spotly Support · Your requests",
  description: "Contact Spotly Support, follow a request, or request a callback.",
  robots: { index: false, follow: false }
};

export default function TicketsPage() {
  return <Suspense fallback={<main className="mx-auto max-w-3xl px-6 py-24 text-sm text-secondary">Opening support…</main>}><TicketsApp /></Suspense>;
}
