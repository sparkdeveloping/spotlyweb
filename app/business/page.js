import { Suspense } from "react";
import { BusinessApp } from "@/components/business-app";
import { WorkspacePageSkeleton } from "@/components/workspace-loading";

export const metadata = {
  title: "Spotly Business · Run your business where Zimbabwe discovers it",
  description: "Claim your business, sell products, take orders and bookings, manage locations, payments, delivery, team access and more with Spotly Business.",
  robots: { index: true, follow: true }
};
export default function BusinessPage() {
  return <Suspense fallback={<WorkspacePageSkeleton role="business" />}><BusinessApp section="portfolio" /></Suspense>;
}
