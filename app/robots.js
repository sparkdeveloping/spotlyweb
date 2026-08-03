export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/claim", "/support", "/devstatus"],
      disallow: ["/admin", "/business", "/driver", "/account", "/marketplace", "/payment", "/api"]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
