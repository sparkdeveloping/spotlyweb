"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, CarFront, Package, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";

const iconMap = {
  eat: UtensilsCrossed,
  shop: ShoppingBag,
  book: Sparkles,
  events: CalendarDays,
  ride: CarFront,
  send: Package
};

export function ServiceGlyph({ service, className }) {
  const Icon = iconMap[service] || Sparkles;
  return <Icon className={cn("h-5 w-5", className)} strokeWidth={1.9} aria-hidden="true" />;
}

function Plate() {
  return <>
    <ellipse cx="76" cy="89" rx="42" ry="18" fill="rgba(255,255,255,.16)" />
    <ellipse cx="76" cy="82" rx="34" ry="14" fill="rgba(255,255,255,.91)" />
    <ellipse cx="76" cy="80" rx="22" ry="8" fill="rgba(255,255,255,.34)" />
    <path d="M56 71c5-7 12-9 20-6 6 2 12 2 18-2 2 8-4 15-12 17-10 3-20 0-26-9Z" fill="rgba(255,255,255,.54)" />
  </>;
}
function Bag() {
  return <>
    <path d="M45 55h61l-5 52H50l-5-52Z" fill="rgba(255,255,255,.88)" />
    <path d="M59 58c0-17 9-27 17-27 10 0 18 10 18 27" fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="7" strokeLinecap="round" />
    <circle cx="64" cy="78" r="5" fill="rgba(255,255,255,.35)" /><circle cx="88" cy="78" r="5" fill="rgba(255,255,255,.35)" />
  </>;
}
function Calendar() {
  return <>
    <rect x="39" y="42" width="74" height="68" rx="17" fill="rgba(255,255,255,.9)" />
    <rect x="39" y="42" width="74" height="24" rx="17" fill="rgba(255,255,255,.36)" />
    <path d="M57 34v17M95 34v17" stroke="rgba(255,255,255,.86)" strokeWidth="7" strokeLinecap="round" />
    <circle cx="64" cy="81" r="6" fill="rgba(255,255,255,.38)"/><path d="m76 82 7 7 14-17" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </>;
}
function Ticket() {
  return <>
    <path d="M42 50h70v18c-8 2-12 7-12 14s4 12 12 14v16H42V96c8-2 12-7 12-14S50 70 42 68V50Z" fill="rgba(255,255,255,.9)" />
    <path d="M72 57v48" stroke="rgba(255,255,255,.42)" strokeWidth="3" strokeDasharray="5 6" />
    <circle cx="89" cy="77" r="9" fill="rgba(255,255,255,.37)" /><path d="M83 96h15" stroke="rgba(255,255,255,.38)" strokeWidth="5" strokeLinecap="round" />
  </>;
}
function Car() {
  return <>
    <path d="M38 78 49 53c3-7 8-11 15-11h27c8 0 13 4 16 11l10 25v24c0 5-3 8-8 8h-6c-5 0-8-3-8-8v-3H58v3c0 5-3 8-8 8h-5c-5 0-8-3-8-8V78Z" fill="rgba(255,255,255,.9)" />
    <path d="m55 58 6-10h33l6 10H55Z" fill="rgba(255,255,255,.38)" />
    <circle cx="57" cy="82" r="6" fill="rgba(255,255,255,.35)" /><circle cx="98" cy="82" r="6" fill="rgba(255,255,255,.35)" />
  </>;
}
function Parcel() {
  return <>
    <path d="m76 32 40 22v45l-40 22-40-22V54l40-22Z" fill="rgba(255,255,255,.9)" />
    <path d="m36 54 40 23 40-23M76 77v44" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="4" />
    <path d="m57 43 40 23" stroke="rgba(255,255,255,.42)" strokeWidth="7" strokeLinecap="round" />
  </>;
}

const shapes = { eat: Plate, shop: Bag, book: Calendar, events: Ticket, ride: Car, send: Parcel };

export function ServiceArtwork({ service, className, compact = false }) {
  const reduce = useReducedMotion();
  const Shape = shapes[service] || Parcel;
  const variants = {
    eat: { y: [0, -2, 0] },
    shop: { rotate: [0, -1.5, 0] },
    book: { y: [0, -1, 0] },
    events: { scale: [1, 1.025, 1] },
    ride: { x: [0, 5, 0] },
    send: { x: [0, 4, 0], y: [0, -2, 0] }
  };
  return <motion.div
    className={cn("spotly-service-art pointer-events-none select-none", compact ? "h-20 w-20" : "h-32 w-32 sm:h-36 sm:w-36", className)}
    animate={reduce ? undefined : variants[service]}
    transition={reduce ? undefined : { duration: service === "ride" ? 3.2 : 4, repeat: Infinity, ease: "easeInOut" }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 152 152" className="h-full w-full overflow-visible">
      <defs><filter id={`shadow-${service}`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="rgba(0,0,0,.18)" /></filter></defs>
      <circle cx="76" cy="76" r="62" fill="rgba(255,255,255,.055)" />
      <g filter={`url(#shadow-${service})`}><Shape /></g>
      {service === "eat" && !reduce ? <g className="spotly-steam"><path d="M63 45c-6-8 7-9 1-18"/><path d="M80 45c-6-8 7-9 1-18"/><path d="M97 45c-6-8 7-9 1-18"/></g> : null}
      {service === "send" ? <path d="M15 118c35 9 45-15 69-11 21 4 29 18 53 9" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 8" /> : null}
      {service === "ride" ? <path d="M13 118c26 4 39-13 57-11 28 3 32 18 68 9" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 8" /> : null}
    </svg>
  </motion.div>;
}
