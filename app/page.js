import { PublicHomeRouter } from "@/components/public-home-router";

export const metadata = {
  title: "Spotly · Ride, eat, shop, book and discover Zimbabwe",
  description: "Use Spotly to discover verified Zimbabwean businesses, order for pickup or delivery, save places, track activity, and explore the services around your city."
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Spotly",
  url: appUrl,
  logo: `${appUrl}/icons/spotly-512.png`,
  areaServed: "Zimbabwe",
  description: "A Zimbabwe-first city platform for discovering businesses, ordering, delivery, bookings, events, and future mobility services."
};

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><PublicHomeRouter /></>;
}
