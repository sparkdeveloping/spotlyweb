import { getPublicSitemapEntries } from "@/lib/public-seo-server";
import { getPublicCustomerSitemapRoutes } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
  const [dynamic, runtimeRoutes] = await Promise.all([getPublicSitemapEntries(), getPublicCustomerSitemapRoutes()]);
  const staticPages = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/branding", changeFrequency: "monthly", priority: 0.45 },
    { path: "/support", changeFrequency: "weekly", priority: 0.7 },
    { path: "/drive", changeFrequency: "weekly", priority: 0.65 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 }
  ].map(({ path, changeFrequency, priority }) => ({ url: `${base}${path}`, changeFrequency, priority }));
  const servicePages = runtimeRoutes.serviceRoutes.map(({ path }) => ({ url: `${base}${path}`, changeFrequency: "daily", priority: 0.88 }));
  const cityServices = runtimeRoutes.cityRoutes.map((route) => ({ url: `${base}/city/${route.citySlug}/${route.serviceSlug}`, changeFrequency: "daily", priority: 0.72 }));
  return [
    ...staticPages,
    ...servicePages,
    ...cityServices,
    ...dynamic.businesses.map((item) => ({ url: `${base}/place/${encodeURIComponent(item.id)}`, lastModified: item.updatedAt || undefined, changeFrequency: "daily", priority: 0.75 })),
    ...dynamic.items.map((item) => ({ url: `${base}/item/${encodeURIComponent(item.id)}`, lastModified: item.updatedAt || undefined, changeFrequency: "daily", priority: 0.65 }))
  ];
}
