import Image from "next/image";

// Static artwork from the supplied Spotly branding kit: no API call, script,
// animation library or timed delay is required before the real page can render.
const MARKS = Object.freeze({
  primary: "/brand/loading/primary-symbol.svg",
  business: "/brand/loading/business-symbol.svg",
  driver: "/brand/loading/driver-symbol.svg",
});

/**
 * Full-view transition used only while a route or its initial authorization
 * context is pending. Small in-page data updates should retain their layout.
 */
export function SpotlyPulseLoader({ tone = "primary", label = "Opening Spotly" }) {
  const safeTone = Object.hasOwn(MARKS, tone) ? tone : "primary";
  return (
    <div
      className={`spotly-pulse-loader spotly-pulse-loader--${safeTone}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className="spotly-pulse-loader__stage" aria-hidden="true">
        <span className="spotly-pulse-loader__glow" />
        <Image
          className="spotly-pulse-loader__mark"
          src={MARKS[safeTone]}
          width={96}
          height={120}
          alt=""
          priority
          unoptimized
        />
      </div>
    </div>
  );
}
