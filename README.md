# Spotly Website

A full Next.js + Tailwind CSS + Framer Motion website for the Spotly customer app direction.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React icons

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm run start
```

## What is included

- Clean commercial landing page matching the app's current OpenTable-style direction
- Launch 2026 positioning
- Product system overview
- Category showcase with Food, Groceries, Events, Activities priority
- Launch partner pipeline section
- Blueprint-style developer identity block
- Responsive phone mockup
- Spotly SVG mark and wordmark
- Tailwind design tokens for the current green-first brand style

## Files to edit first

- `data/site.ts` — categories, features, partner pipeline, launch steps
- `app/page.tsx` — page composition
- `components/Hero.tsx` — hero content and phone mockup placement
- `components/CategoryShowcase.tsx` — app categories
- `components/PartnerPipeline.tsx` — launch partner pipeline
- `tailwind.config.ts` — brand colors, radii, shadows

## Notes

This is a static website shell. It is intentionally not connected to Firebase or Paynow yet. Keep it visually aligned with the SwiftUI app as that app evolves.
