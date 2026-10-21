"use client";

import { CalendarDays, Coffee, HeartPulse, Scissors, ShoppingBag, Sparkles, Store, UtensilsCrossed } from "lucide-react";
import { marketplaceProfile } from "@/lib/marketplace-taxonomy";

// This illustration is generated from Spotly's design primitives, not a
// merchant photograph or logo. It never implies a business partnership.
export function MarketplaceDesignedCover({ business, compact = false }) {
  const profile = marketplaceProfile(business || {});
  const family = profile.mediaFamily;
  const Icon = ["eat", "bakery", "nightlife"].includes(family) ? UtensilsCrossed
    : family === "cafe" ? Coffee
    : ["beauty", "hair", "barber", "nails", "spa"].includes(family) ? Scissors
    : ["medical", "dental", "pharmacy"].includes(family) ? HeartPulse
    : ["events", "music", "festival", "sports_event"].includes(family) ? CalendarDays
    : ["groceries", "shop", "fashion", "footwear", "electronics", "home", "retail"].includes(family) ? ShoppingBag
    : family === "services" ? Sparkles : Store;
  return <div className="relative isolate flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,var(--accent-soft)_0%,var(--surface-2)_55%,var(--surface)_100%)] p-4 text-[var(--text)] sm:p-5">
    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-60 w-60 rounded-full border-[22px] border-[color-mix(in_srgb,var(--accent)_13%,transparent)] opacity-80"/>
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] blur-xl"/>
    <span className="relative w-fit rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[var(--surface)]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-secondary">Spotly discovery</span>
    <div className="relative flex min-h-0 flex-1 items-center justify-center py-1">
      <span className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[var(--surface)] text-[var(--accent)] shadow-sm sm:h-20 sm:w-20">
        <Icon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.6}/>
      </span>
    </div>
    <div className="relative"><p className={compact ? "truncate text-sm font-semibold" : "text-base font-semibold"}>{profile.displayCategory}</p><p className="mt-1 text-[11px] text-secondary">Illustrative category card</p></div>
  </div>;
}
