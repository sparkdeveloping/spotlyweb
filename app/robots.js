export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/claim", "/support", "/privacy", "/terms"],
      disallow: ["/admin", "/business", "/driver", "/staff", "/account", "/marketplace", "/payment", "/devstatus", "/login", "/api"]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
