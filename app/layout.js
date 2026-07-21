import "./globals.css";
import { AppProviders } from "@/components/providers";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Spotly",
    template: "%s · Spotly"
  },
  description: "One Spotly web platform for customers, businesses, drivers, and platform operations.",
  applicationName: "Spotly",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/spotly.png",
    apple: "/brand/spotly.png"
  },
  openGraph: {
    title: "Spotly",
    description: "Discover, book, order, deliver, and operate in one Spotly platform.",
    images: ["/brand/spotly.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
