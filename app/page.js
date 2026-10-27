import { PublicHomeRouter } from "@/components/public-home-router";

export const metadata = {
  title: "Spotly First Access · Your city, so much closer",
  description: "Get Spotly First Access. Create your account, tell us what you’re most excited about, and be among the first in Zimbabwe to hear when your city opens up."
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
