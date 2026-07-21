export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return ["", "/business", "/driver", "/admin", "/login"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "weekly" : "daily",
    priority: path ? 0.8 : 1
  }));
}
