"use client";

import Image from "next/image";

const rideAssets = Object.freeze({
 economy: "/ride/vehicles/economy.svg",
 comfort: "/ride/vehicles/comfort.svg",
 xl: "/ride/vehicles/xl.svg"
});

// These represent service categories, never the assigned Driver's exact car.
export function RideVehicleArt({ type = "economy", className = "" }) {
 const key = String(type || "economy").toLowerCase();
 return <Image src={rideAssets[key] || rideAssets.economy} alt="" aria-hidden="true"
   unoptimized width={180} height={95}
   className={`block h-auto max-w-full object-contain ${className}`} />;
}

// A beacon animation indicates ongoing matching, not how many cars are nearby.
export function RideMatchingBeacon({ size = 64 }) {
 return <span role="img" aria-label="Searching for an eligible Driver"
   className="spotly-ride-beacon relative inline-flex shrink-0 items-center justify-center"
   style={{ width: size, height: size }}>
   <style>{`
    @keyframes spotly-ride-beacon-pulse {
      0% { opacity:.65; transform: translate(-50%, -50%) scale(.55); }
      100% { opacity:0; transform: translate(-50%, -50%) scale(2.0); }
    }
    .spotly-ride-beacon-wave {
      position:absolute; left:50%; top:50%; width:40%; height:40%; border:1.5px solid currentColor;
      border-radius:999px; transform:translate(-50%,-50%) scale(.55);
      animation:spotly-ride-beacon-pulse 3s linear infinite; pointer-events:none;
    }
    @media (prefers-reduced-motion: reduce) {
      .spotly-ride-beacon-wave { animation:none; transform:translate(-50%,-50%) scale(1.4); opacity:.32; }
      .spotly-ride-beacon-wave:not(:first-child) { display:none; }
    }
   `}</style>
   {[0, 1, 2].map(i => <span key={i} className="spotly-ride-beacon-wave text-[var(--accent)]"
     style={{ animationDelay: `-${i}s` }} aria-hidden="true" />)}
   <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]" aria-hidden="true">
     <span className="h-2.5 w-2.5 rounded-full bg-current" />
   </span>
 </span>;
}
