import { PublicHomeRouter } from "@/components/public-home-router";

export const metadata = {
  title: "Zimbabwe's local marketplace · Shop nearby with Spotly",
  description: "Find verified Zimbabwean businesses nearby, see what each location offers, then pick up or get delivery where available."
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Spotly",
  url: appUrl,
  logo: `${appUrl}/icons/spotly-512.png`,
  areaServed: "Zimbabwe",
  description: "A Zimbabwe-first marketplace for discovering nearby businesses, ordering ahead, and choosing pickup or delivery where available."
};

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><PublicHomeRouter /></>;
}
