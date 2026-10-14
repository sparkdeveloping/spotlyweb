import { ClaimApp } from "@/components/claim-app";

export const metadata = {
  title: "Get started · Spotly Business",
  description: "Find, claim, or add your business and prepare it for Spotly.",
  robots: { index: false, follow: false }
};

export default async function BusinessGetStartedPage({ searchParams }) {
  const params = await searchParams;
  return <ClaimApp initialBusinessId={params?.business || ""} newBusiness={params?.new === "1"} initialName={params?.name || ""} initialDraftId={params?.draft || ""} businessJourney />;
}
