import { DriverMarketingPage } from "@/components/driver/driver-marketing";
import { spotlyLoginUrl } from "@/lib/spotly-domains";

export const metadata = {
  title: "Drive and earn with Spotly",
  description: "See how Spotly Driver works, check likely requirements for your vehicle, and apply for Ride, delivery, Shop & Deliver and Send work in supported Zimbabwe cities.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://driver.spotlyafrica.com" },
};

export default function DrivePage() {
  const loginHref = spotlyLoginUrl("driver", { next: "/", mode: "signin" });
  return <DriverMarketingPage loginHref={loginHref} />;
}
