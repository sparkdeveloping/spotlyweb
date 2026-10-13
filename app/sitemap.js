import { getPublicSitemapEntries } from "@/lib/public-seo-server";

export const revalidate = 3600;

export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
  const published = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/eat", changeFrequency: "daily", priority: 0.9 },
    { path: "/shop", changeFrequency: "daily", priority: 0.9 },
    { path: "/book", changeFrequency: "daily", priority: 0.85 },
    { path: "/events", changeFrequency: "daily", priority: 0.85 },
    { path: "/ride", changeFrequency: "weekly", priority: 0.7 },
    { path: "/send", changeFrequency: "weekly", priority: 0.7 },
    { path: "/support", changeFrequency: "weekly", priority: 0.7 },
    { path: "/drive", changeFrequency: "weekly", priority: 0.65 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 }
  ].map(({ path, changeFrequency, priority }) => ({ url: `${base}${path}`, changeFrequency, priority }));
  const dynamic = await getPublicSitemapEntries();
  const citySlugs = ["harare", "bulawayo", "chitungwiza", "mutare", "gweru", "masvingo", "kwekwe", "kadoma", "chinhoyi", "marondera", "victoria-falls", "gwanda", "zvishavane", "gokwe", "chipinge"];
  const cityServices = citySlugs.flatMap((city) => ["eat", "shop", "book", "events"].map((service) => ({ url: `${base}/city/${city}/${service}`, changeFrequency: "daily", priority: city === "harare" ? 0.78 : 0.68 })));
  return [
    ...published,
    ...cityServices,
    ...dynamic.businesses.map((item) => ({ url: `${base}/place/${encodeURIComponent(item.id)}`, lastModified: item.updatedAt || undefined, changeFrequency: "daily", priority: 0.75 })),
    ...dynamic.items.map((item) => ({ url: `${base}/item/${encodeURIComponent(item.id)}`, lastModified: item.updatedAt || undefined, changeFrequency: "daily", priority: 0.65 }))
  ];
}
