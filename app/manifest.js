import { headers } from "next/headers";
import { portalForHostname } from "@/lib/spotly-domains";

const MANIFESTS = {
  customer: {
    name: "Spotly",
    short_name: "Spotly",
    description: "Find nearby businesses, order ahead, and choose pickup or delivery where available.",
    theme_color: "#6657D9"
  },
  business: {
    name: "Spotly Business",
    short_name: "Business",
    description: "Run your Spotly business, locations, orders, team, delivery and Money.",
    theme_color: "#147A4A"
  },
  driver: {
    name: "Spotly Driver",
    short_name: "Driver",
    description: "Manage Spotly delivery offers, active deliveries, earnings and Driver support.",
    theme_color: "#2563EB"
  },
  staff: {
    name: "Spotly Staff",
    short_name: "Staff",
    description: "Access Spotly work, schedule, learning, people tools and internal support.",
    theme_color: "#111827"
  },
  admin: {
    name: "Spotly Admin",
    short_name: "Admin",
    description: "Operate Spotly marketplace, delivery, finance, risk and platform administration.",
    theme_color: "#28466F"
  }
};

export default async function manifest() {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "spotlyafrica.com").split(":")[0];
  const portal = portalForHostname(host);
  const product = MANIFESTS[portal] || MANIFESTS.customer;
  return {
    ...product,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    icons: [
      { src: "/icons/spotly-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/spotly-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/spotly-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
