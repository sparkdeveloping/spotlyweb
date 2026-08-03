export default function manifest() {
  return {
    name: "Spotly",
    short_name: "Spotly",
    description: "Discover Zimbabwean businesses and arrange grocery pickup with Spotly.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6657D9",
    icons: [
      { src: "/brand/spotly.png", sizes: "1254x1254", type: "image/png", purpose: "any maskable" }
    ]
  };
}
