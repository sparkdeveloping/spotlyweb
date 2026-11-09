import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
import { getPublicServiceSeo } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export async function generateMetadata() {
  const availability = await getPublicServiceSeo("book");
  return {
    title: "SpotlyBook",
    description: "Discover services, stays and activities and manage requests through Spotly.",
    robots: availability.indexable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: "/book" },
    openGraph: { title: "SpotlyBook | Spotly", description: "Discover services, stays and activities and manage requests through Spotly.", url: "/book" }
  };
}

export default function ServicePage() {
  return <Suspense fallback={<CustomerPageSkeleton />}><MarketplaceApp basePath="/book" initialService="book" /></Suspense>;
}
