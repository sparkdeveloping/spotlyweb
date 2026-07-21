import { AdminApp } from "@/components/admin-app";

export async function generateMetadata({ params }) {
  const { section } = await params;
  return { title: `${section.charAt(0).toUpperCase()}${section.slice(1)} · Admin` };
}

export default async function AdminSectionPage({ params }) {
  const { section } = await params;
  return <AdminApp section={section} />;
}
