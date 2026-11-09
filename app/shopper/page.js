import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
import { getPublicServiceSeo } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export async function generateMetadata() {
  const availability = await getPublicServiceSeo("shop");
  return {
    title: "SpotlyShopper",
    description: "Stores, products, groceries and personal shopping on Spotly.",
    robots: availability.indexable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: "/shopper" },
    openGraph: { title: "SpotlyShopper | Spotly", description: "Stores, products, groceries and personal shopping on Spotly.", url: "/shopper" }
  };
}

export default function SpotlyShopperPage() {
  return <Suspense fallback={<CustomerPageSkeleton/>}><MarketplaceApp basePath="/shopper" initialService="shop"/></Suspense>;
}
