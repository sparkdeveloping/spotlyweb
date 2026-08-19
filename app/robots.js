export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
  const marketplaceIndexable = process.env.NEXT_PUBLIC_MARKETPLACE_INDEXABLE === "true";
  return {
    rules: {
      userAgent: "*",
      allow: marketplaceIndexable ? ["/", "/marketplace", "/support", "/privacy", "/terms"] : ["/", "/support", "/privacy", "/terms"],
      disallow: [
        "/admin", "/business", "/driver", "/staff", "/account", "/payment", "/login", "/api",
        "/claim/drafts", "/claim/status", ...(marketplaceIndexable ? [] : ["/marketplace"])
      ]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
