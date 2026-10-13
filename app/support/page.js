import { Suspense } from "react";
import { SupportApp } from "@/components/support-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";

export const metadata = { title: "Help and support", description: "Practical Spotly guides and support conversations." };

export default function SupportPage() {
  return <Suspense fallback={<CustomerPageSkeleton compact />}><SupportApp /></Suspense>;
}
