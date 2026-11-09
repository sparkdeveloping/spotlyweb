import { SendApp } from "@/components/send-app";
import { getPublicServiceSeo } from "@/lib/customer-runtime-server";

export const revalidate = 300;

export async function generateMetadata() {
  const availability = await getPublicServiceSeo("send");
  return { title: "SpotlySend", description: "Send a parcel across your city with an approved Spotly Driver, live tracking and verified pickup and delivery.", robots: availability.indexable ? { index: true, follow: true } : { index: false, follow: true }, alternates: { canonical: "/send" } };
}

export default function SendPage() { return <SendApp />; }
