import { DriverMarketingPage } from "@/components/driver/driver-marketing";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export const metadata = {
  title: "Drive and earn with Spotly",
  description: "See how Spotly Driver works, check likely requirements for your vehicle, and apply for Ride, delivery, Shop & Deliver and Send work in supported Zimbabwe cities.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://driver.spotlyafrica.com" },
};

export default function DrivePage() {
  const loginHref = spotlyPortalUrl("driver", "/login?portal=driver&next=%2F");
  return <DriverMarketingPage loginHref={loginHref} />;
}
