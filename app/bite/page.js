import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
import { getPublicServiceSeo } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export async function generateMetadata() {
  const availability = await getPublicServiceSeo("eat");
  return {
    title: "SpotlyBite",
    description: "Restaurants, food, takeaway, pickup and delivery on Spotly.",
    robots: availability.indexable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: "/bite" },
    openGraph: { title: "SpotlyBite | Spotly", description: "Restaurants, food, takeaway, pickup and delivery on Spotly.", url: "/bite" }
  };
}

export default function SpotlyBitePage() {
  return <Suspense fallback={<CustomerPageSkeleton/>}><MarketplaceApp basePath="/bite" initialService="eat"/></Suspense>;
}
