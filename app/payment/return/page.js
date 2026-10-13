import { Suspense } from "react";
import { PaymentReturnApp } from "@/components/payment-return-app";

export const metadata = { title: "Payment status" };

export default function PaymentReturnPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--surface)]" />}><PaymentReturnApp /></Suspense>;
}
