import { RideApp } from "@/components/ride-app";
import { getPublicServiceSeo } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export async function generateMetadata() {
  const availability = await getPublicServiceSeo("ride");
  return { title: "SpotlyRide", description: "Request a Spotly Ride, see your fare estimate, match with an approved Driver and track the trip.", robots: availability.indexable ? { index: true, follow: true } : { index: false, follow: true }, alternates: { canonical: "/ride" } };
}

export default function RidePage() { return <RideApp />; }
