import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";

export const metadata = {
  title: process.env.NEXT_PUBLIC_MARKETPLACE_INDEXABLE === "true" ? "Marketplace" : "Private marketplace",
  description: "Find nearby businesses, choose the exact location, build a basket, and follow pickup orders in Spotly."
};

export default function MarketplacePage() {
  return <Suspense fallback={<CustomerPageSkeleton />}><MarketplaceApp /></Suspense>;
}
