import { ComingSoonApp } from "@/components/coming-soon-app";

export const metadata = {
  title: "Find nearby. Order ahead. Pick up.",
  description: "Join Spotly's launch list to discover nearby Zimbabwean businesses, order ahead, and collect when it is ready."
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Spotly",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://spotlyweb.vercel.app",
  logo: `${process.env.NEXT_PUBLIC_APP_URL || "https://spotlyweb.vercel.app"}/icons/spotly-512.png`,
  description: "A Zimbabwean marketplace for discovering nearby businesses, ordering ahead, and collecting when ready."
};

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><ComingSoonApp /></>;
}
