import { DriverApp } from "@/components/driver-app";

export const metadata = {
  title: "Spotly Driver · Drive, deliver and earn with Spotly",
  description: "See how Spotly Driver works, check likely requirements for your vehicle, and apply for Ride, delivery, Shop & Deliver and Send work in supported African cities.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://driver.spotlyafrica.com" },
};

export default function DriverPage() {
  return <DriverApp section="home" />;
}
