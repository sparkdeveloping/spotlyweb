import { PublicHomeRouter } from "@/components/public-home-router";
import { getPublishedCustomerSettings, getPublicCustomerSitemapRoutes } from "@/lib/customer-runtime-server";
import { SPOTLY_PRODUCTS } from "@/lib/spotly-products";

export const revalidate = 300;

export async function generateMetadata() {
  const settings = await getPublishedCustomerSettings();
  const routes = await getPublicCustomerSitemapRoutes(settings);
  const mode = settings?.launch?.publicMode || "first_access";
  if (mode === "maintenance") return { title: "Spotly · Temporarily unavailable", description: "Spotly customer access is temporarily paused while we work on the platform.", robots: { index: false, follow: true } };
  if (["first_access", "coming-soon", "private-beta"].includes(mode)) return { title: "Spotly First Access · Your city, so much closer", description: "Get Spotly First Access. Create your account, tell us what you’re most excited about, and be among the first to hear when Spotly opens in your city." };
  const labels = routes.serviceRoutes.map(({ service }) => SPOTLY_PRODUCTS[service]?.nav).filter(Boolean);
  const serviceCopy = labels.length ? ` Explore ${labels.join(", ")} where they are available.` : "";
  return { title: "Spotly · Your city. A little closer.", description: `Discover useful places and services around your city with Spotly.${serviceCopy}`, robots: { index: true, follow: true } };
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Spotly",
  url: appUrl,
  logo: `${appUrl}/api/branding/assets/primary_symbol_color.svg`,
  areaServed: "Africa",
  description: "An African city-first platform for discovering businesses, ordering, delivery, bookings, events, and future mobility services."
};

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><PublicHomeRouter /></>;
}
