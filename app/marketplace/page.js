import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";

export const metadata = {
  title: "Marketplace preview",
  description: "Find nearby businesses, build a basket, and follow pickup orders in the Spotly private preview."
};

export default function MarketplacePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#fffdf9]" />}><MarketplaceApp /></Suspense>;
}
