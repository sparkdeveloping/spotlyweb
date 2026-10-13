import { Suspense } from "react";
import { PaymentReturnApp } from "@/components/payment-return-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";

export const metadata = { title: "Payment status" };

export default function PaymentReturnPage() {
  return <Suspense fallback={<CustomerPageSkeleton compact />}><PaymentReturnApp /></Suspense>;
}
