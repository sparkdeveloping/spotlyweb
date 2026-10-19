import { Suspense } from "react";
import { AssistBookingApp } from "@/components/assist-booking-app";
export const metadata = { title: "Request an appointment · Spotly Assist", description: "Ask Spotly to check an appointment time with a local business.", robots: { index: false, follow: false } };
export default async function Page({ searchParams }) {
  const values = await searchParams;
  return <Suspense fallback={<p>Loading Spotly Assist…</p>}><AssistBookingApp businessId={String(values?.business || "")}/></Suspense>;
}
