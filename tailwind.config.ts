import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        spotly: {
          50: "#effdf5",
          100: "#d9fbe8",
          200: "#b7f5d2",
          300: "#80eab2",
          400: "#41d789",
          500: "#18b86b",
          600: "#0d9354",
          700: "#0c7646",
          800: "#0b5d39",
          900: "#08442d",
          950: "#032419"
        },
        ink: "#08111f",
        slateSoft: "#687386",
        paper: "#fbfbf8",
        line: "#e8ecef"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        soft: "0 24px 80px rgba(8, 17, 31, 0.10)",
        card: "0 18px 48px rgba(8, 17, 31, 0.08)",
        green: "0 24px 64px rgba(13, 147, 84, 0.24)"
      },
      borderRadius: {
        card: "1.35rem",
        panel: "2rem"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(8, 17, 31, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(8, 17, 31, 0.05) 1px, transparent 1px)",
        heroGlow: "radial-gradient(circle at top left, rgba(24, 184, 107, 0.22), transparent 34%), radial-gradient(circle at 85% 16%, rgba(13, 147, 84, 0.12), transparent 28%)"
      }
    }
  },
  plugins: []
};

export default config;
