import { Suspense } from "react";
import { LoginApp } from "@/components/login-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";

export const metadata = { title: "Sign in", description: "Sign in to your Spotly account and available workspaces." };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <Suspense fallback={<CustomerPageSkeleton compact />}><LoginApp initialPortal={params?.portal || "customer"} initialMode={params?.mode || "signin"} /></Suspense>;
}
