import { Suspense } from "react";
import { CareerApplicationStatus } from "@/components/careers-app";

export const metadata = { title: "Application status", robots: { index: false, follow: false, nocache: true } };

export default async function CareerApplicationPage({ params }) { const { applicationId } = await params; return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}><CareerApplicationStatus applicationId={applicationId} /></Suspense>; }
