import { Suspense } from "react";
import { BusinessApp } from "@/components/business-app";
import { WorkspacePageSkeleton } from "@/components/workspace-loading";

export const metadata = { title: "Business portfolio · Spotly Business", description: "Manage every business, claim, invitation, and access relationship on Spotly." };
export default function BusinessPage() {
  return <Suspense fallback={<WorkspacePageSkeleton role="business" />}><BusinessApp section="portfolio" /></Suspense>;
}
