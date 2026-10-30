"use client";

import Image from "next/image";
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CalendarClock2, CarFront, Package, ShoppingBag, Sparkles, Ticket, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";
import { serviceIdentity } from "@/lib/service-identity";

const iconMap = { eat: UtensilsCrossed, shop: ShoppingBag, book: CalendarClock2, events: Ticket, ride: CarFront, send: Package };

export function ServiceGlyph({ service, className }) {
  const Icon = iconMap[service] || Sparkles;
  return <Icon className={cn("h-5 w-5", className)} strokeWidth={1.8} aria-hidden="true" />;
}

/** Local, pre-sized illustrations. Static at rest; no renderer, polling or animation loop. */
export function ServiceArtwork({ service, className, compact = false, priority = false }) {
  const reduce = useReducedMotion();
  const [failedSource, setFailedSource] = useState("");
  const identity = serviceIdentity(service);
  const src = `/experience/services/${identity.asset}-${compact ? 320 : 640}.webp`;
  return <span className={cn("spotly-service-art experience-art pointer-events-none select-none", className)} data-motion={reduce ? "still" : "responsive"} aria-hidden="true">
    {failedSource === src ? <span className="experience-art-fallback"><ServiceGlyph service={service} className="h-16 w-16" /></span> : <Image src={src} alt="" width={compact ? 320 : 640} height={compact ? 320 : 640} priority={priority} unoptimized draggable={false} onError={() => setFailedSource(src)} className="experience-art-image" />}
  </span>;
}
