import { BusinessApp } from "@/components/business-app";

export async function generateMetadata({ params }) {
  const { section } = await params;
  return { title: `${section.charAt(0).toUpperCase()}${section.slice(1)} · Business` };
}

export default async function BusinessSectionPage({ params }) {
  const { section } = await params;
  return <BusinessApp section={section} />;
}
