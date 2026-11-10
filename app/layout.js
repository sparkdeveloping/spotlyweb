import "@/app/first-access.css";
import "./globals.css";
import "./v7-experience.css";
import "./admin-v8.css";
import { AppProviders } from "@/components/providers";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { CustomerLaunchGate } from "@/components/customer-launch-gate";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyafrica.com";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Spotly · Your city, one place",
    template: "%s · Spotly"
  },
  description: "Use Spotly to discover local businesses, order for pickup or delivery, save places, track activity, and explore the services around your city.",
  applicationName: "Spotly",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/api/branding/assets/primary_symbol_color.svg", type: "image/svg+xml" }, { url: "/icons/spotly-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    title: "Spotly · Your city, one place",
    description: "Ride, eat, shop, book, discover and send with Spotly in your city as services become available.",
    url: appUrl,
    siteName: "Spotly",
    images: ["/icons/spotly-512.png"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotly · Your city, one place",
    description: "Ride, eat, shop, book, discover and send with Spotly in your city as services become available.",
    images: ["/icons/spotly-512.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // First paint is intentionally light. ThemeProvider updates this dynamically
  // if a returning user has explicitly selected Dark or System resolves dark.
  themeColor: "#ffffff"
};

const themeBootstrap = `(() => {
  try {
    const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("spotly_theme="));
    const shared = cookie ? decodeURIComponent(cookie.slice("spotly_theme=".length)) : "";
    const stored = localStorage.getItem("spotly-theme");
    const candidate = shared || stored;
    const selected = ["light", "dark", "system"].includes(candidate) ? candidate : "light";
    const resolved = selected === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : selected;
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = selected;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
  } catch (_) {}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body>
        <AppProviders><ConnectivityBanner /><CustomerLaunchGate>{children}</CustomerLaunchGate></AppProviders>
      </body>
    </html>
  );
}
