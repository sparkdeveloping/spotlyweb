import { DriverAcquisitionLanding } from "@/components/driver/driver-acquisition-landing";

export const metadata = {
  title: "Join Spotly Driver",
  description: "Leave your details for Spotly Driver onboarding.",
  robots: { index: false, follow: false },
};

export default async function DriverCampaignJoinPage({ params }) {
  const { campaign = "" } = await params;
  return <DriverAcquisitionLanding campaignSlug={campaign} />;
}
