import { StaffApp } from "@/components/staff-app";

export async function generateMetadata({ params }) {
  const { section } = await params;
  return { title: `${section.charAt(0).toUpperCase()}${section.slice(1)} · Staff` };
}

export default async function StaffSectionPage({ params }) {
  const { section } = await params;
  return <StaffApp section={section} />;
}
