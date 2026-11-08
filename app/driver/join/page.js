import { DriverAcquisitionLanding } from "@/components/driver/driver-acquisition-landing";

export const metadata = {
  title: "Join Spotly Driver",
  description: "Tell Spotly where you want to drive or deliver. Leave your details and the Driver team can help you continue onboarding.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://driver.spotlyafrica.com/join" },
};

export default function DriverJoinPage() {
  return <DriverAcquisitionLanding campaignSlug="" />;
}
