import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotly — One app for your city",
  description:
    "Spotly is building a cleaner city-life platform for rides, food, shopping, bookings, events, and sending across Zimbabwe.",
  metadataBase: new URL("https://spotlyafrica.com"),
  openGraph: {
    title: "Spotly — One app for your city",
    description:
      "Discover the updated Spotly 2.0 web direction inspired by the new customer product experience.",
    images: ["/spotly-customer-preview.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6657D9"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
