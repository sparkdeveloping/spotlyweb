import { Suspense } from "react";
import { BusinessApp } from "@/components/business-app";

export const metadata = { title: "Business portfolio · Spotly Business", description: "Manage every business, claim, invitation, and access relationship on Spotly." };
export default function BusinessPage() {
  return <Suspense fallback={<main className="min-h-screen bg-grouped" />}><BusinessApp section="portfolio" /></Suspense>;
}
