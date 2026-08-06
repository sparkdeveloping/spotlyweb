export default function manifest() {
  return {
    name: "Spotly",
    short_name: "Spotly",
    description: "Find nearby businesses, order ahead, and collect when it is ready.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6657D9",
    icons: [
      { src: "/icons/spotly-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/spotly-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };
}
