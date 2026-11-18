"use client";
import { useReportWebVitals } from "next/web-vitals";

// Set NEXT_PUBLIC_SPOTLY_VITALS_MODE=debug on staging to observe route vitals.
// No remote telemetry / identifiers / Firestore writes are performed here.
export function SpotlyVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NEXT_PUBLIC_SPOTLY_VITALS_MODE !== "debug") return;
    if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(metric.name)) return;
    // Rounded to limit precision and prevent event-specific identifiers leaking.
    console.info("[Spotly Web Vital]", metric.name, Math.round(metric.value * 100) / 100, metric.rating);
  });
  return null;
}
