export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/eat", "/shop", "/book", "/events", "/ride", "/send", "/marketplace", "/place/", "/item/", "/support", "/drive", "/privacy", "/terms"],
      disallow: ["/admin", "/business", "/driver", "/staff", "/account", "/activity", "/saved", "/notifications", "/referrals", "/payment", "/login", "/api", "/claim/drafts", "/claim/status"]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
