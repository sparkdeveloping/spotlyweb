export default function sitemap() {
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
  ];
  return published.map(({ path, changeFrequency, priority }) => ({ url: `${base}${path}`, changeFrequency, priority }));
}
