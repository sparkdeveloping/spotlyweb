import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";
import { getPublicServiceSeo, resolveCanonicalCityRoute } from "@/lib/customer-runtime-server";

export const revalidate = 300;

const SERVICE_COPY = {
  eat: { title: "Spotly Bite · Food delivery & pickup", description: "Restaurants, dishes, pickup and delivery available through Spotly." },
  shop: { title: "Spotly Shopper · Local shopping", description: "Stores and products available through Spotly." },
  book: { title: "Spotly Book · Services & bookings", description: "Book services, activities and stays available through Spotly." },
  events: { title: "Spotly Live · Events & tickets", description: "Discover events and ticket options available through Spotly." }
};

async function resolvePage(values) {
  const route = resolveCanonicalCityRoute(values.city, values.service);
  if (!route) return null;
  const availability = await getPublicServiceSeo(route.service, { country: route.country.code, city: route.city.name });
  return { ...route, config: SERVICE_COPY[route.service], availability };
}

export async function generateMetadata({ params }) {
  const route = await resolvePage(await params);
  if (!route || !route.availability.visible) return { title: "Service not available", robots: { index: false, follow: false } };
  const description = `${route.config.description} Explore Spotly in ${route.city.name}, ${route.country.name}.`;
  return {
    title: `${route.config.title} in ${route.city.name}`,
    description,
    robots: route.availability.indexable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: `/city/${route.citySlug}/${route.serviceSlug}` },
    openGraph: {
      title: `${route.config.title} in ${route.city.name} | Spotly`,
      description,
      url: `/city/${route.citySlug}/${route.serviceSlug}`,
      type: "website"
    }
  };
}

export default async function CityServicePage({ params }) {
  const route = await resolvePage(await params);
  if (!route || !route.availability.visible) notFound();
  const url = `https://spotlyafrica.com/city/${route.citySlug}/${route.serviceSlug}`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${route.config.title} in ${route.city.name}`,
    description: `${route.config.description} Explore Spotly in ${route.city.name}, ${route.country.name}.`,
    url,
    about: { "@type": "City", name: route.city.name, addressCountry: route.country.code },
    isPartOf: { "@type": "WebSite", name: "Spotly", url: "https://spotlyafrica.com" }
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><Suspense fallback={<CustomerPageSkeleton />}><MarketplaceApp basePath={`/city/${route.citySlug}/${route.serviceSlug}`} initialService={route.service} initialCity={route.city.name} /></Suspense></>;
}
