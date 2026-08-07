import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";

export const metadata = {
  title: process.env.NEXT_PUBLIC_MARKETPLACE_INDEXABLE === "true" ? "Marketplace" : "Private marketplace",
  description: "Find nearby businesses, choose the exact location, build a basket, and follow pickup orders in Spotly."
};

export default function MarketplacePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}><MarketplaceApp /></Suspense>;
}
