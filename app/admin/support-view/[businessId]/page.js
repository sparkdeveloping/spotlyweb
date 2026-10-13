import { SupportViewApp } from "@/components/support-view-app";

export const metadata = { title: "Business support view" };

export default async function SupportViewPage({ params }) {
  const { businessId } = await params;
  return <SupportViewApp businessId={businessId} />;
}
