import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MarketplaceApp } from "@/components/marketplace-app";

export const revalidate = 300;

const CITY_MAP = {
  harare: "Harare",
  bulawayo: "Bulawayo",
  chitungwiza: "Chitungwiza",
  mutare: "Mutare",
  gweru: "Gweru",
  masvingo: "Masvingo",
  kwekwe: "Kwekwe",
  kadoma: "Kadoma",
  chinhoyi: "Chinhoyi",
  marondera: "Marondera",
  "victoria-falls": "Victoria Falls",
  gwanda: "Gwanda",
  zvishavane: "Zvishavane",
  gokwe: "Gokwe",
  chipinge: "Chipinge"
};
const SERVICES = {
  eat: { title: "Food delivery & pickup", description: "Restaurants, dishes, pickup and delivery available through Spotly." },
  shop: { title: "Local shopping", description: "Stores and products available through Spotly." },
  book: { title: "Services & bookings", description: "Book services, activities and stays available through Spotly." },
  events: { title: "Events & tickets", description: "Discover events and ticket options available through Spotly." }
};

function resolve(citySlug, service) {
  const city = CITY_MAP[String(citySlug || "").toLowerCase()];
  const config = SERVICES[String(service || "").toLowerCase()];
  return city && config ? { city, config, service: String(service).toLowerCase(), citySlug: String(citySlug).toLowerCase() } : null;
}

export async function generateMetadata({ params }) {
  const values = await params;
  const route = resolve(values.city, values.service);
  if (!route) return {};
  return {
    title: `${route.config.title} in ${route.city}`,
    description: `${route.config.description} Explore live Spotly businesses in ${route.city}, Zimbabwe.`,
    alternates: { canonical: `/city/${route.citySlug}/${route.service}` },
    openGraph: {
      title: `${route.config.title} in ${route.city} | Spotly`,
      description: `${route.config.description} Explore live Spotly businesses in ${route.city}, Zimbabwe.`,
      url: `/city/${route.citySlug}/${route.service}`,
      type: "website"
    }
  };
}

export default async function CityServicePage({ params }) {
  const values = await params;
  const route = resolve(values.city, values.service);
  if (!route) notFound();
  const url = `https://spotlyafrica.com/city/${route.citySlug}/${route.service}`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${route.config.title} in ${route.city}`,
    description: `${route.config.description} Explore live Spotly businesses in ${route.city}, Zimbabwe.`,
    url,
    about: { "@type": "City", name: route.city, addressCountry: "ZW" },
    isPartOf: { "@type": "WebSite", name: "Spotly", url: "https://spotlyafrica.com" }
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}><MarketplaceApp basePath={`/city/${route.citySlug}/${route.service}`} initialService={route.service} initialCity={route.city} /></Suspense></>;
}
