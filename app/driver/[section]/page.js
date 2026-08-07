import { DriverApp } from "@/components/driver-app";

export async function generateMetadata({ params }) {
  const { section } = await params;
  return { title: `${section.charAt(0).toUpperCase()}${section.slice(1)} · Driver training`, robots: { index: false, follow: false } };
}

export default async function DriverSectionPage({ params }) {
  const { section } = await params;
  return <DriverApp section={section} />;
}
