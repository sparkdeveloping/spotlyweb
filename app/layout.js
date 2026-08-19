import "./globals.css";
import { AppProviders } from "@/components/providers";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spotlyweb.vercel.app";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Spotly",
    template: "%s · Spotly"
  },
  description: "Find verified Zimbabwean businesses nearby, order ahead, and choose pickup or delivery where available.",
  applicationName: "Spotly",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/spotly.svg", type: "image/svg+xml" }, { url: "/icons/spotly-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    title: "Spotly",
    description: "Find verified Zimbabwean businesses nearby, order ahead, and choose pickup or delivery where available.",
    url: appUrl,
    siteName: "Spotly",
    images: ["/icons/spotly-512.png"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotly",
    description: "Find verified Zimbabwean businesses nearby, order ahead, and choose pickup or delivery where available.",
    images: ["/icons/spotly-512.png"]
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

const themeBootstrap = `(() => {
  try {
    const stored = localStorage.getItem("spotly-theme");
    const selected = ["light", "dark", "system"].includes(stored) ? stored : "system";
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
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
