import { RideApp } from "@/components/ride-app";

export const metadata = {
  title: "Ride with Spotly",
  description: "Request a Spotly Ride, see your fare estimate, match with an approved Driver and track the trip.",
  alternates: { canonical: "/ride" }
};

export default function RidePage() { return <RideApp />; }
