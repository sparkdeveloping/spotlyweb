import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";

const copy = {
  eat: ["Eat", "Order food from live restaurants and food businesses on Spotly."],
  shop: ["Shop", "Browse products and stores available through Spotly."],
  book: ["Book", "Discover services, stays and activities and manage requests through Spotly."],
  events: ["Events", "Discover upcoming events and ticket options on Spotly."],
  ride: ["Ride", "Open Spotly Ride and see availability in your area."],
  send: ["Send", "Open Spotly Send and see availability in your area."]
};

export const metadata = {
  title: copy["book"][0],
  description: copy["book"][1],
  alternates: { canonical: "/book" }
};

export default function ServicePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[var(--background)]" />}><MarketplaceApp basePath="/book" initialService="book" /></Suspense>;
}
