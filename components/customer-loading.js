import { SpotlyPulseLoader } from "@/components/spotly-pulse-loader";

// Compatibility name retained for existing Suspense call sites.
// Full-page fallback is a calm brand pulse, not a fabricated page skeleton.
export function CustomerPageSkeleton() {
  return <SpotlyPulseLoader label="Loading Spotly" />;
}

export function CustomerContentSkeleton({ rows = 4 }) {
  return <div className="py-3" aria-busy="true" aria-label="Loading content">
    <div className="v7-skeleton h-4 w-28 rounded-full" />
    <div className="v7-skeleton mt-4 h-10 w-[52%] max-w-lg rounded-[12px]" />
    <div className="v7-skeleton mt-3 h-4 w-[70%] max-w-xl rounded-[10px]" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: rows }, (_, item) => <div key={item}><div className="v7-skeleton aspect-[1.28/1] rounded-[16px]" /><div className="v7-skeleton mt-3 h-4 w-2/3 rounded-[10px]" /><div className="v7-skeleton mt-2 h-3 w-1/2 rounded-[10px]" /></div>)}</div>
  </div>;
}
