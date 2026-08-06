import { Suspense } from "react";
import { LoginApp } from "@/components/login-app";

export const metadata = { title: "Sign in", description: "Sign in to your Spotly account and available workspaces." };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <Suspense fallback={<main className="min-h-screen bg-grouped" />}><LoginApp initialPortal={params?.portal || "customer"} /></Suspense>;
}
