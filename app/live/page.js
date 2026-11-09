import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
import { getPublicServiceSeo } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export async function generateMetadata() {
  const availability = await getPublicServiceSeo("events");
  return {
    title: "SpotlyLive",
    description: "Local events, festivals, venues and tickets on Spotly.",
    robots: availability.indexable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: "/live" },
    openGraph: { title: "SpotlyLive | Spotly", description: "Local events, festivals, venues and tickets on Spotly.", url: "/live" }
  };
}

export default function SpotlyLivePage() {
  return <Suspense fallback={<CustomerPageSkeleton/>}><MarketplaceApp basePath="/live" initialService="events"/></Suspense>;
}
