export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const published = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/claim", changeFrequency: "weekly", priority: 0.8 },
    { path: "/support", changeFrequency: "weekly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 }
  ];
  return published.map(({ path, changeFrequency, priority }) => ({ url: `${base}${path}`, changeFrequency, priority }));
}
