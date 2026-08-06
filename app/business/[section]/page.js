import { Suspense } from "react";
import { BusinessApp } from "@/components/business-app";

export async function generateMetadata({ params }) {
  const { section } = await params;
  return { title: `${section.charAt(0).toUpperCase()}${section.slice(1)} · Spotly Business` };
}

export default async function BusinessSectionPage({ params }) {
  const { section } = await params;
  return <Suspense fallback={<main className="min-h-screen bg-grouped" />}><BusinessApp section={section} /></Suspense>;
}
