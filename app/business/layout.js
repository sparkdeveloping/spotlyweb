import { BusinessLayoutClient } from "@/components/business/business-layout-client";

export const metadata = {
  title: {
    default: "Spotly Business",
    template: "%s · Spotly Business"
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function BusinessLayout({ children }) {
  return <BusinessLayoutClient>{children}</BusinessLayoutClient>;
}
