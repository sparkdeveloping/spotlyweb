import { ComingSoonApp } from "@/components/coming-soon-app";

export const metadata = {
  title: "Find nearby. Order ahead. Pick up or get delivery.",
  description: "Discover nearby Zimbabwean businesses, order ahead, choose pickup or delivery where available, and follow clear status updates."
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Spotly",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://spotlyweb.vercel.app",
  logo: `${process.env.NEXT_PUBLIC_APP_URL || "https://spotlyweb.vercel.app"}/icons/spotly-512.png`,
  description: "A Zimbabwean marketplace for discovering nearby businesses, ordering ahead, and choosing pickup or delivery where available."
};

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><ComingSoonApp /></>;
}
