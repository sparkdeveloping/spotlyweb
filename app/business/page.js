import { Suspense } from "react";
import { BusinessApp } from "@/components/business-app";

export const metadata = { title: "Today · Spotly Business", description: "Run today’s business operations on Spotly." };
export default function BusinessPage() {
  return <Suspense fallback={<main className="min-h-screen bg-grouped" />}><BusinessApp section="dashboard" /></Suspense>;
}
