import { CustomerApp } from "@/components/customer-app";

export const metadata = {
  title: "Discover, book, and order",
  description: "Explore trusted restaurants, groceries, events, beauty, wellness, activities, and bookings with Spotly."
};

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  return <CustomerApp initialView={params?.view || "home"} />;
}
