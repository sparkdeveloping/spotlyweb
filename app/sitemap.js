export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyweb.vercel.app";
  const marketplaceIndexable = process.env.NEXT_PUBLIC_MARKETPLACE_INDEXABLE === "true";
  const published = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/support", changeFrequency: "weekly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    ...(marketplaceIndexable ? [{ path: "/marketplace", changeFrequency: "daily", priority: 0.9 }] : [])
  ];
  return published.map(({ path, changeFrequency, priority }) => ({ url: `${base}${path}`, changeFrequency, priority }));
}
