/** @type {import('next').NextConfig} */
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://www.gstatic.com https://apis.google.com https://www.google.com https://www.recaptcha.net https://cdn.sheetjs.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://yt3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.paynow.co.zw https://paynow.co.zw https://firebaseappcheck.googleapis.com https://www.google.com https://www.recaptcha.net",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.google.com https://www.recaptcha.net https://*.paynow.co.zw https://paynow.co.zw",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self' https://*.paynow.co.zw https://paynow.co.zw",
  "upgrade-insecure-requests"
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  serverExternalPackages: ["firebase-admin", "paynow"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" }
    ]
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self)" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Content-Security-Policy-Report-Only", value: cspReportOnly }
      ]
    },
    {
      source: "/firebase-messaging-sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" }
      ]
    }
  ]
};

export default nextConfig;
