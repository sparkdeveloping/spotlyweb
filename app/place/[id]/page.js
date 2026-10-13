import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MarketplaceApp } from "@/components/marketplace-app";
import { getPublicBusinessForSeo } from "@/lib/public-seo-server";
import { CustomerPageSkeleton } from "@/components/customer-loading";

export const revalidate = 60;

const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const business = await getPublicBusinessForSeo(id);
  if (!business) return { title: "Business not available", robots: { index: false, follow: false } };
  const title = `${business.name} on Spotly`;
  const description = business.description || `${business.category} in ${business.area || business.city || "Zimbabwe"}. View current offerings and locations on Spotly.`;
  return { title, description, alternates: { canonical: `/place/${id}` }, openGraph: { title, description, url: `${base}/place/${id}`, type: "website", ...(business.image ? { images: [{ url: business.image }] } : {}) } };
}

export default async function PlacePage({ params }) {
  const { id } = await params;
  const business = await getPublicBusinessForSeo(id);
  if (!business) notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": "LocalBusiness", name: business.name, description: business.description || undefined, image: business.image || undefined, telephone: business.phone || undefined, address: { "@type": "PostalAddress", streetAddress: business.address || undefined, addressLocality: business.city || undefined, addressCountry: "ZW" }, url: `${base}/place/${id}`, ...(business.rating && business.reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: business.rating, reviewCount: business.reviewCount } } : {}) };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} /><Suspense fallback={<CustomerPageSkeleton />}><MarketplaceApp basePath="/" initialBusinessId={id} /></Suspense></>;
}
