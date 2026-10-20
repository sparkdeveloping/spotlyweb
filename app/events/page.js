import { Suspense } from "react";
import { MarketplaceApp } from "@/components/marketplace-app";
import { CustomerPageSkeleton } from "@/components/customer-loading";

const copy = {
  eat: ["Eat", "Order food from live restaurants and food businesses on Spotly."],
  shop: ["Shop", "Browse products and stores available through Spotly."],
  book: ["Book", "Discover services, stays and activities and manage requests through Spotly."],
  events: ["SpotlyLive", "Discover upcoming events and ticket options on Spotly."],
  ride: ["Ride", "Open Spotly Ride and see availability in your area."],
  send: ["Send", "Open Spotly Send and see availability in your area."]
};

export const metadata = {
  title: copy["events"][0],
  description: copy["events"][1],
  alternates: { canonical: "/live" }
};

export default function ServicePage() {
  return <Suspense fallback={<CustomerPageSkeleton />}><MarketplaceApp basePath="/events" initialService="events" /></Suspense>;
}
