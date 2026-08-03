export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/claim", changeFrequency: "weekly", priority: 0.9 },
    { path: "/support", changeFrequency: "weekly", priority: 0.8 },
    { path: "/devstatus", changeFrequency: "weekly", priority: 0.6 },
    { path: "/login", changeFrequency: "monthly", priority: 0.4 }
  ].map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority
  }));
}
