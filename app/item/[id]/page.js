import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MarketplaceApp } from "@/components/marketplace-app";
import { getPublicItemForSeo } from "@/lib/public-seo-server";

export const revalidate = 60;

const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const item = await getPublicItemForSeo(id);
  if (!item) return { title: "Offering not available", robots: { index: false, follow: false } };
  const title = `${item.name} · ${item.business.name} | Spotly`;
  const description = item.description || `View ${item.name} from ${item.business.name} on Spotly.`;
  return { title, description, alternates: { canonical: `/item/${id}` }, openGraph: { title, description, url: `${base}/item/${id}`, type: "website", ...(item.image ? { images: [{ url: item.image }] } : {}) } };
}

export default async function ItemPage({ params }) {
  const { id } = await params;
  const item = await getPublicItemForSeo(id);
  if (!item) notFound();
  const isEvent = ["event", "ticket"].includes(String(item.itemType).toLowerCase());
  const jsonLd = isEvent ? { "@context": "https://schema.org", "@type": "Event", name: item.name, description: item.description || undefined, image: item.image || undefined, startDate: item.startsAt || undefined, endDate: item.endsAt || undefined, location: item.venue ? { "@type": "Place", name: item.venue } : undefined, organizer: { "@type": "Organization", name: item.business.name }, url: `${base}/item/${id}`, ...(item.price !== null ? { offers: { "@type": "Offer", price: item.price, priceCurrency: item.currency, availability: item.available ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: `${base}/item/${id}` } } : {}) } : { "@context": "https://schema.org", "@type": "Product", name: item.name, description: item.description || undefined, image: item.image || undefined, category: item.category || undefined, brand: { "@type": "Brand", name: item.business.name }, url: `${base}/item/${id}`, ...(item.price !== null ? { offers: { "@type": "Offer", price: item.price, priceCurrency: item.currency, availability: item.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base}/item/${id}` } } : {}) };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} /><Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}><MarketplaceApp basePath="/" initialBusinessId={item.businessId} initialOfferId={id} /></Suspense></>;
}
