"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  MapPin,
  PackageCheck,
  Search,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Ticket,
  Truck
} from "lucide-react";
import { loadServiceFeed, track } from "@/lib/firebase-services";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { Badge, Button, EmptyState, SearchField } from "@/components/ui";
import { ServiceEntrance, ServiceSwitcher } from "@/components/service-identity";
import { ServiceArtwork } from "@/components/service-artwork";
import { MarketplaceTrustBadge } from "@/components/marketplace-trust-ui";
import { marketplaceMedia, marketplaceMediaSet } from "@/lib/marketplace-editorial";
import { MarketplaceDesignedCover } from "@/components/marketplace-designed-cover";
import { marketplaceActionLabel, marketplaceProfile } from "@/lib/marketplace-taxonomy";
import { marketplaceEditorial } from "@/lib/marketplace-curation";
import { THEMENU_RESTAURANT_SPOTLIGHTS, themenuPriceLabel } from "@/lib/themenu-curated-spotlights";

const SERVICE_CONFIG = {
  eat: {
    label: "Spotly Bite",
    eyebrow: "Food around you",
    title: "What are you craving?",
    description: "Find your next good meal. Explore restaurants and menus, with ordering where it’s available.",
    search: "Search dishes, restaurants or cuisines",
    businesses: "Restaurants to explore",
    items: "Dishes to explore",
    suggestions: ["Chicken", "Pizza", "Coffee", "Lunch", "Dessert"]
  },
  shop: {
    label: "Spotly Shopper",
    eyebrow: "Stores and essentials",
    title: "Find what you need nearby",
    description: "Everyday essentials and unexpected finds. Explore local stores, with published prices and stock where available.",
    search: "Search products, brands or stores",
    businesses: "Stores to explore",
    items: "Products to explore",
    suggestions: ["Groceries", "Pharmacy", "Home", "Fashion", "Gifts"]
  },
  book: {
    label: "Spotly Book",
    eyebrow: "Services, stays and activities",
    title: "Make time for something",
    description: "Discover services and experiences with real businesses, then request a time and keep the plan in Activity.",
    search: "Search massage, salon, fitness, stays…",
    businesses: "Bookable places",
    items: "Services and experiences",
    suggestions: ["Massage", "Salon", "Fitness", "Activities", "Stay"]
  },
  events: {
    label: "Spotly Live",
    eyebrow: "What’s happening",
    title: "Make plans in your city",
    description: "Find upcoming events, venues and ticket options published by live Spotly businesses.",
    search: "Search events, venues or categories",
    businesses: "Event organisers and venues",
    items: "Upcoming events",
    suggestions: ["Tonight", "Weekend", "Music", "Food", "Markets"]
  }
};

const COMPLETE_ORDER_STATUSES = new Set(["completed", "delivered", "checked_out"]);

function harareDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eventBucket(startsAt) {
  if (!startsAt) return "later";
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "later";
  const todayKey = harareDateKey(new Date());
  const key = harareDateKey(date);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Harare", hour: "2-digit", hourCycle: "h23" }).format(date));
  if (key === todayKey && hour >= 17) return "tonight";
  if (key === todayKey) return "today";
  const todayDate = new Date(`${todayKey}T00:00:00Z`);
  const eventDate = new Date(`${key}T00:00:00Z`);
  const differenceDays = Math.round((eventDate.getTime() - todayDate.getTime()) / 86400000);
  const weekday = todayDate.getUTCDay();
  const weekendStart = weekday === 0 ? -2 : weekday === 6 ? -1 : 5 - weekday;
  const weekendEnd = weekendStart + 2;
  if (differenceDays >= weekendStart && differenceDays <= weekendEnd) return "weekend";
  return "later";
}

function eventDateLabel(value) {
  if (!value) return "Date to be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-ZW", { timeZone: "Africa/Harare", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function money(item, currency) {
  const value = Number(item?.prices?.[currency] ?? item?.price);
  return Number.isFinite(value) && value > 0 ? formatCurrency(value, currency || item?.currency || "USD") : value === 0 ? "Free" : "";
}

function mediaForBusiness(business) {
  return marketplaceMedia(business);
}

function imageForBusiness(business) {
  return mediaForBusiness(business).src;
}

function pickupTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = harareDateKey(new Date());
  const key = harareDateKey(date);
  const time = new Intl.DateTimeFormat("en-ZW", { timeZone: "Africa/Harare", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  if (key === today) return `Pickup from ${time}`;
  return `Pickup ${new Intl.DateTimeFormat("en-ZW", { timeZone: "Africa/Harare", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}`;
}

function ServiceSkeleton() {
  return <div className="experience-feed-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="experience-loading-dot" aria-hidden="true" /><span>Finding published places and offerings…</span>
    <div className="experience-loading-lines" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}

function BusinessCard({ business, media: assignedMedia, favorite, onFavorite, onOpen, service, currency }) {
  const profile = marketplaceProfile(business);
  const editorial = profile.service === "shop" ? marketplaceEditorial(business) : null;
  const [assistExplained, setAssistExplained] = useState(false);
  const assisted = Boolean(business.assistStoreId);
  const media = assignedMedia || mediaForBusiness(business);
  const image = media.src;
  const operation = business.operational || {};
  const commerce = profile.cardMode === "commerce";
  const assistedBooking = service === "book" && !commerce && !assisted && business.assistAccepting !== false;
  const action = marketplaceActionLabel(business, service);
  return <article className={cn("group relative overflow-hidden rounded-[var(--radius-card)] border bg-[var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card", commerce ? "border-[var(--border-subtle)]" : "border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)]")}>
    <button type="button" onClick={() => assisted ? window.location.assign("/shop-for-me?store=" + encodeURIComponent(business.assistStoreId)) : assistedBooking ? window.location.assign("/assist/book?business=" + encodeURIComponent(business.id)) : onOpen(business)} className="block w-full text-left">
      <div className={cn("relative overflow-hidden", commerce ? "aspect-[16/10] bg-[var(--surface-2)]" : "aspect-[16/9] bg-[var(--surface-2)]")}>
        {image ? <Image src={image} alt="" fill className="object-cover transition duration-300 group-hover:scale-[1.025]" sizes="(max-width: 768px) 100vw, 33vw" /> : <MarketplaceDesignedCover business={business} />}
        {image ? <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" /> : null}
        {image && media.kind === "licensed-directory" ? <span title="Licensed directory photograph supplied by The Menu; not a claim of merchant affiliation." className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-[var(--on-accent)] backdrop-blur">Photo: The Menu</span> : null}
        {image && media.kind === "editorial" ? <span title="Editorial category image — not supplied by this business" aria-label="Editorial category image" className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-[var(--media-text)] backdrop-blur"><Info className="h-3.5 w-3.5" /></span> : null}
        {commerce && image ? <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">{business.isFeatured ? <Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">Featured</Badge> : null}<MarketplaceTrustBadge business={business} compact />{operation.openNow ? <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0">Open now</Badge> : null}{business.promotion ? <Badge className="bg-[var(--accent)] text-[var(--on-accent)] ring-0">{business.promotion.name || "Offer"}</Badge> : null}</div> : null}
      </div>
      <div className={cn("p-4", !commerce && "pb-3")}>
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="truncate text-[17px] font-semibold tracking-[-.025em]">{business.name}</h3><p className="mt-1 truncate text-sm text-[var(--text-3)]">{profile.displayCategory}{business.area || business.city ? ` · ${business.area || business.city}` : ""}</p></div><ChevronRight className="mt-1 h-5 w-5 text-[var(--text-3)]" /></div>
        {editorial?.signal === "established_retail_brand" ? <p className="mt-2 text-[11px] text-[var(--text-3)]">Established chain · Spotly editorial, not customer reviews</p> : editorial?.branchReviewRequired ? <p className="mt-2 text-[11px] font-semibold text-[var(--text-2)]">Branch information needs re-verification</p> : null}
        {assistedBooking ? <div className="mt-3 text-xs font-medium text-[var(--text-2)]">Ask Spotly to check your preferred time</div> : null}
        {assisted ? <div className="mt-3 text-xs font-medium text-[var(--text-2)]">Menu prices estimated · Spotly confirms before payment</div> : null}
        {commerce ? <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-[var(--text-2)]">
          {operation.deliveryAvailable ? <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Delivery{operation.deliveryFeeFrom > 0 ? ` from ${formatCurrency(operation.deliveryFeeFrom, currency || "USD")}` : ""}</span> : null}
          {operation.pickupAvailable ? <span className="inline-flex items-center gap-1.5"><PackageCheck className="h-3.5 w-3.5" />{pickupTimeLabel(operation.earliestPickup) || "Pickup"}</span> : null}
          {operation.locationCount ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{operation.locationCount} {operation.locationCount === 1 ? "location" : "locations"}</span> : null}
        </div> : <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--text-3)]">{assisted ? "Assisted purchase · not a partner" : assistedBooking ? "Booking request · subject to confirmation" : "Directory listing · commerce not enabled"}</span><span className="font-semibold text-[var(--accent)]">{assisted ? "Request items" : assistedBooking ? "Request time" : action} <span aria-hidden="true">→</span></span></div>}
        {commerce ? <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">{action}<ArrowRight className="h-3.5 w-3.5" /></div> : null}
      </div>
    </button>
    {(assisted || assistedBooking) ? <div className="absolute left-3 top-3 flex items-center gap-2"><span className="rounded-full border border-white/30 bg-[var(--surface)]/95 px-3 py-1.5 text-xs font-semibold text-[var(--text)]">Spotly Assist</span><button type="button" onClick={() => setAssistExplained(true)} aria-label="How Spotly Assist works" className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text)] shadow-sm"><Info className="h-4 w-4"/></button></div> : null}
    {(assisted || assistedBooking) && assistExplained ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssistExplained(false)}><div role="dialog" aria-modal="true" aria-label="About Spotly Assist" className="max-w-sm rounded-2xl bg-[var(--surface)] p-5 text-[var(--text)] shadow-xl" onClick={(event) => event.stopPropagation()}><h4 className="text-lg font-semibold">Spotly helps arrange it</h4><p className="mt-3 text-sm leading-6 text-[var(--text-2)]">This store is not necessarily partnered with Spotly. We independently collect basic item information and check prices and availability before an authorized shopper buys on your behalf. A request isn’t a paid order or guaranteed delivery.</p><button type="button" onClick={() => setAssistExplained(false)} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">Got it</button></div></div> : null}
    <button type="button" onClick={() => onFavorite(business.id)} aria-label={favorite ? "Remove from saved" : "Save business"} className={cn("absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/35 text-[var(--media-text)] backdrop-blur transition hover:bg-black/50", favorite && "bg-[var(--surface)] text-[var(--danger)]")}><Heart className={cn("h-4 w-4", favorite && "fill-current")} /></button>
  </article>;
}

/**
 * Low-commitment directory records are intentionally a separate list layout.
 * Do not mix 16:9 photo cards with 112px rows: CSS Grid stretches the rows
 * to the tallest image card and creates giant empty blocks.
 */
function DirectoryListingRow({ business, favorite, onFavorite, onOpen }) {
  const profile = marketplaceProfile(business);
  const editorial = profile.service === "shop" ? marketplaceEditorial(business) : null;
  const media = marketplaceMedia(business);
  // Only show actual location-matched/licensed imagery. An unrelated editorial
  // category photo is not a photograph of a named shop or restaurant.
  const licensed = media.kind === "licensed-directory";
  const image = licensed ? media.src : "";
  return <article className="group flex h-full min-w-0 min-h-[112px] items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] hover:bg-[var(--surface-hover)] sm:gap-4">
    <button type="button" onClick={()=>onOpen(business)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left sm:gap-4">
      <span className="relative flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {image?<Image src={image} alt={`Photo of ${business.name}; source: The Menu`} fill sizes="78px" className="object-cover"/>:<Store className="h-6 w-6" aria-hidden="true"/>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-[-.02em] text-[var(--text)]">{business.name}</span>
        <span className="mt-1 block truncate text-xs text-secondary">{profile.displayCategory}{business.area||business.city?` · ${business.area||business.city}`:""}</span>
        <span className="mt-2 block text-[11px] font-medium text-[var(--text-3)]">{editorial?.branchReviewRequired ? "Spotly guide: branch needs re-verification" : editorial?.signal === "established_retail_brand" ? "Established chain · Spotly editorial, not a customer rating" : licensed ? "Source photo: The Menu" : "Explore place details"}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-secondary transition group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
    <button type="button" onClick={()=>onFavorite?.(business)} aria-label={favorite?`Remove ${business.name} from Saved`:`Save ${business.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-secondary transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
      <Heart className={cn("h-[17px] w-[17px]", favorite&&"fill-current")}/>
    </button>
  </article>;
}

function ItemCard({ item, service, currency, saved, onOpen, onSave }) {
  const image = item.image;
  const price = money(item, currency);
  const event = service === "events";
  const book = service === "book";
  const deal = Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0;
  return <article className="experience-result-card group overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card">
    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
        {image ? <Image src={image} alt="" fill className="object-cover transition duration-300 group-hover:scale-[1.025]" sizes="(max-width: 640px) 50vw, 260px" /> : <div className="flex h-full items-center justify-center text-[var(--accent)]">{event ? <Ticket className="h-8 w-8" /> : book ? <CalendarDays className="h-8 w-8" /> : <ShoppingBag className="h-8 w-8" />}</div>}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">{item.isFeatured ? <Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">Featured</Badge> : null}{deal ? <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0"><Tag className="mr-1 h-3 w-3" />Deal</Badge> : null}{item.promotion ? <Badge className="bg-[var(--accent)] text-[var(--on-accent)] ring-0">{item.promotion.name || "Offer"}</Badge> : null}</div>
      </div>
      <div className="p-4">
        <p className="truncate text-xs font-medium text-[var(--text-3)]">{item.businessName || item.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-5 tracking-[-.015em]">{item.name}</h3>
        {event ? <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--text-2)]"><Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />{eventDateLabel(item.startsAt)}</p> : null}
        {book && item.durationMinutes > 0 ? <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-3)]"><Clock3 className="h-3.5 w-3.5" />{item.durationMinutes} min</p> : null}
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-semibold">{price || (book ? "Price on request" : "Open for details")}</span>{event && item.remainingCapacity !== null ? <span className="text-xs text-[var(--text-3)]">{item.remainingCapacity} left</span> : null}</div>
      </div>
    </button>
    <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-2"><button type="button" onClick={() => onOpen(item)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">{event ? "Tickets" : book ? "Book" : "View"}<ArrowRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onSave(item)} className={cn("flex h-11 w-11 items-center justify-center rounded-full transition", saved ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--text-3)] hover:bg-[var(--surface-hover)]")} aria-label={saved ? "Remove from saved" : "Save"}><Heart className={cn("h-4 w-4", saved && "fill-current")} /></button></div>
  </article>;
}

function filterBusiness(business, filter) {
  if (filter === "delivery") return business.operational?.deliveryAvailable;
  if (filter === "pickup") return business.operational?.pickupAvailable;
  if (filter === "open") return business.operational?.openNow;
  return true;
}

function filterEvent(item, filter) {
  if (filter === "free") return Number(item.price || 0) <= 0;
  if (["today", "tonight", "weekend"].includes(filter)) return eventBucket(item.startsAt) === filter || (filter === "today" && eventBucket(item.startsAt) === "tonight");
  return true;
}

function sortItems(items, sort, service, currency) {
  const output = [...items];
  if (sort === "price") return output.sort((a, b) => Number(a.prices?.[currency] ?? a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.prices?.[currency] ?? b.price ?? Number.MAX_SAFE_INTEGER));
  if (sort === "soonest" && service === "events") return output.sort((a, b) => new Date(a.startsAt || 8640000000000000).getTime() - new Date(b.startsAt || 8640000000000000).getTime());
  return output;
}

function SortControl({ value, onChange, events }) {
  const options = [{ value: "recommended", label: "Recommended" }, ...(events ? [{ value: "soonest", label: "Soonest" }] : []), { value: "price", label: "Lowest price" }];
  return <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-1" aria-label="Sort results">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn("shrink-0 rounded-[10px] px-3 py-2 text-xs font-semibold transition", value === option.value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-3)] hover:text-[var(--text)]")}>{option.label}</button>)}</div>;
}

export function ServiceDiscoveryView({
  service,
  location,
  currency,
  favorites = [],
  savedItems = [],
  orders = [],
  onOpenBusiness,
  onOpenItem,
  onToggleFavorite,
  onToggleSaved,
  onHome,
  onSelectService,
  onSearchAll,
  onLocation,
  onActivity
}) {
  const config = SERVICE_CONFIG[service] || SERVICE_CONFIG.eat;
  const [query, setQuery] = useState("");
  const [feed, setFeed] = useState({ businesses: [], items: [], categories: [], facets: {}, totalBusinesses: 0, totalItems: 0, nextOffset: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [productDepartment, setProductDepartment] = useState("all");
  const [filter, setFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState(service === "events" ? "soonest" : "recommended");

  useEffect(() => {
    setQuery("");
    setCategory("all");
    setProductDepartment("all");
    setFilter("all");
    setSort(service === "events" ? "soonest" : "recommended");
  }, [service]);
  useEffect(() => { track("service_view", { service, city: location.city || "", area_selected: Boolean(location.area) }); }, [service, location.city, location.area]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await loadServiceFeed(service, { city: location.city, area: location.area, query, limit: 24 });
        if (!active) return;
        setFeed(result);
        if (query.trim().length >= 2) track(result.totalItems || result.totalBusinesses ? "service_search_results" : "service_search_zero_results", { service, query_length: query.trim().length, item_count: Number(result.totalItems || 0), business_count: Number(result.totalBusinesses || 0), city: location.city || "" });
      } catch (reason) {
        if (!active) return;
        setError(reason.message || `${config.label} could not be refreshed right now.`);
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [service, location.city, location.area, query, config.label, refreshKey]);

  async function loadMore() {
    if (feed.nextOffset == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadServiceFeed(service, { city: location.city, area: location.area, query, limit: 24, offset: feed.nextOffset });
      setFeed((current) => ({ ...result, items: [...current.items, ...(result.items || [])] }));
    } catch (reason) {
      setError(reason.message || "More results could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  const categoryOptions = useMemo(() => {
    if (service !== "shop") return (feed.categories || []).map((label) => ({ key: label, label }));
    const seen = new Map();
    for (const business of feed.businesses || []) { const profile = marketplaceProfile(business); if (!seen.has(profile.vertical)) seen.set(profile.vertical, profile.displayCategory); }
    return [...seen].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [feed.businesses, feed.categories, service]);
  const productDepartments = useMemo(() => service !== "shop" ? [] : [...new Set(feed.items.map((item) => item.categoryPath?.[1] || item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [feed.items, service]);
  const businessVertical = useMemo(() => new Map(feed.businesses.map((business) => [business.id, marketplaceProfile(business).vertical])), [feed.businesses]);
  const itemFilterMatches = useMemo(() => feed.items
    .filter((item) => service === "events" ? filterEvent(item, filter) : filter === "deals" ? ((Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0) || Boolean(item.promotion)) : true)
    .filter((item) => category === "all" || (service === "shop" ? businessVertical.get(item.businessId) === category : item.category === category))
    .filter((item) => service !== "shop" || productDepartment === "all" || item.categoryPath?.includes(productDepartment) || item.category === productDepartment),
  [feed.items, filter, category, service, businessVertical, productDepartment]);
  const itemBusinessIds = useMemo(() => new Set(itemFilterMatches.map((item) => item.businessId)), [itemFilterMatches]);
  const visibleBusinesses = useMemo(() => feed.businesses.filter((business) => filterBusiness(business, filter)).filter((business) => {
    if (category === "all") return true;
    if (service === "shop") return marketplaceProfile(business).vertical === category;
    return [business.category, ...(business.categories || [])].includes(category) || itemBusinessIds.has(business.id);
  }).filter((business) => !["deals", "today", "tonight", "weekend", "free"].includes(filter) || itemBusinessIds.has(business.id)), [feed.businesses, filter, category, itemBusinessIds, service]);
  const visibleItems = useMemo(() => sortItems(itemFilterMatches, sort, service, currency), [itemFilterMatches, sort, service, currency]);
  const commerceBusinesses = useMemo(() => visibleBusinesses.filter((business) => marketplaceProfile(business).cardMode === "commerce"), [visibleBusinesses]);
  const assistBusinesses = useMemo(() => visibleBusinesses.filter((business) =>
    marketplaceProfile(business).cardMode !== "commerce" && Boolean(business.assistStoreId) &&
    business.assistAccepting !== false), [visibleBusinesses]);
  const directoryBusinesses = useMemo(() => visibleBusinesses.filter((business) =>
    marketplaceProfile(business).cardMode !== "commerce" &&
    !(business.assistStoreId && business.assistAccepting !== false)), [visibleBusinesses]);
  const featured = commerceBusinesses.filter((business) => business.isFeatured).slice(0, 4);
  const completedOrder = orders.find((order) => COMPLETE_ORDER_STATUSES.has(String(order.status || "").toLowerCase()) && order.businessId && visibleBusinesses.some((business) => business.id === order.businessId));
  const recentBusiness = completedOrder ? visibleBusinesses.find((business) => business.id === completedOrder.businessId) : null;
  const isSaved = (item) => savedItems.some((saved) => saved.type === item.type && saved.entityId === item.id);
  const filterOptions = service === "events"
    ? [{ key: "all", label: "All" }, { key: "today", label: "Today" }, { key: "tonight", label: "Tonight" }, { key: "weekend", label: "Weekend" }, { key: "free", label: "Free" }]
    : service === "book"
      ? [{ key: "all", label: "All" }, { key: "open", label: "Open now" }]
      : [{ key: "all", label: "All" }, { key: "delivery", label: `Delivery${feed.facets?.delivery ? ` ${feed.facets.delivery}` : ""}` }, { key: "pickup", label: `Pickup${feed.facets?.pickup ? ` ${feed.facets.pickup}` : ""}` }, { key: "open", label: `Open now${feed.facets?.openNow ? ` ${feed.facets.openNow}` : ""}` }, { key: "deals", label: `Deals${feed.facets?.deals ? ` ${feed.facets.deals}` : ""}` }];
  const hasPreciseLocation = Boolean(location.area || location.latitude || location.lat);
  const localityLabel = hasPreciseLocation ? "Around your selected location" : `Discover ${location.city || "your city"}`;
  const hasInventory = feed.businesses.length > 0 || feed.items.length > 0;
  const isFiltered = Boolean(query.trim() || category !== "all" || productDepartment !== "all" || filter !== "all");

  return <div className="v7-page-enter experience-discovery pb-8" data-service={service}>
    <ServiceEntrance service={service} title={config.title} description={config.description}>
      <SearchField value={query} onChange={setQuery} label={`Search ${config.label}`} placeholder={config.search} inputProps={{ autoComplete: "off", enterKeyHint: "search" }} />
      <div className="experience-suggestions no-scrollbar" aria-label="Search suggestions">{config.suggestions.map((suggestion) => <button type="button" key={suggestion} aria-pressed={query === suggestion || (service === "events" && filter === suggestion.toLowerCase())} onClick={() => { if (service === "events" && suggestion === "Tonight") { setQuery(""); setFilter("tonight"); } else if (service === "events" && suggestion === "Weekend") { setQuery(""); setFilter("weekend"); } else { setQuery(suggestion); } }}>{suggestion}<ArrowRight className="h-3 w-3" aria-hidden="true" /></button>)}</div>
    </ServiceEntrance>

    <div className="mt-4 flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 lg:flex-row lg:items-center lg:justify-between">
      <ServiceSwitcher service={service} onSelectService={onSelectService} onHome={onHome} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-3)]">
        <button type="button" onClick={onLocation} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 font-semibold transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />{location.area || location.city || "Choose location"}</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onSearchAll} className="font-semibold text-[var(--text-2)] hover:text-[var(--accent)]">Search all Spotly</button>
      </div>
    </div>

    {recentBusiness ? <section className="mt-5 flex flex-col gap-3 border-y border-[var(--border-subtle)] py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent)]"><Clock3 className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-[var(--accent)]">Again</p><p className="mt-1 text-sm font-semibold">{service === "book" ? "Return to" : service === "events" ? "See what’s new from" : "Order again from"} {recentBusiness.name}</p></div></div><div className="flex gap-2"><Button size="sm" onClick={() => onOpenBusiness(recentBusiness)}>Open</Button><Button size="sm" variant="ghost" onClick={onActivity}>Activity</Button></div></section> : null}

    <section className="mt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{localityLabel}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{query ? `Results for “${query}”` : config.businesses}</h2><p className="mt-1 text-sm text-[var(--text-3)]">{loading ? "Finding published places…" : `${visibleBusinesses.length} ${visibleBusinesses.length === 1 ? "place" : "places"}${commerceBusinesses.length ? ` · ${commerceBusinesses.length} available on Spotly` : " · directory discovery"}`}</p></div><div className="experience-filter-chips no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">{filterOptions.map((option) => <button key={option.key} type="button" aria-pressed={filter === option.key} onClick={() => setFilter(option.key)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition", filter === option.key ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>{option.label}</button>)}</div></div>

      {categoryOptions.length ? <div aria-label="Types of places" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1"><button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")} className={cn("min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", category === "all" ? "bg-[var(--text)] text-[var(--background)]" : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>All categories</button>{categoryOptions.slice(0, 24).map((item) => <button type="button" key={item.key} aria-pressed={category === item.key} onClick={() => setCategory(item.key)} className={cn("min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", category === item.key ? "bg-[var(--text)] text-[var(--background)]" : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>{item.label}</button>)}</div> : null}

      {service === "shop" && productDepartments.length > 1 ? <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Product departments"><span className="shrink-0 text-xs font-semibold text-[var(--text-3)]">Products</span><button type="button" aria-pressed={productDepartment === "all"} onClick={() => setProductDepartment("all")} className={cn("min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-semibold", productDepartment === "all" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--text-2)]")}>All</button>{productDepartments.slice(0, 16).map((name) => <button type="button" key={name} aria-pressed={productDepartment === name} onClick={() => setProductDepartment(name)} className={cn("min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-semibold", productDepartment === name ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--text-2)]")}>{name}</button>)}</div> : null}

      {loading ? <div className="mt-5"><ServiceSkeleton /></div> : error && !feed.businesses.length ? <EmptyState className="mt-5" icon={Search} title={`${config.label} is temporarily unavailable`} description="Spotly could not refresh this service right now. Your other services and Activity are still available." action={<Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>Try again</Button>} /> : visibleBusinesses.length ? <div className="mt-6 space-y-10">
        {commerceBusinesses.length ? <div><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Available on Spotly</p><h3 className="mt-1 text-lg font-semibold tracking-[-.025em]">Ready for {service === "book" ? "booking" : service === "events" ? "tickets" : service === "eat" ? "ordering" : "shopping"}</h3></div><span className="text-xs text-[var(--text-3)]">Verified commerce</span></div><div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{(() => { const listed = commerceBusinesses.slice(0, 12); const media = marketplaceMediaSet(listed); return listed.map((business) => <BusinessCard key={business.id} business={business} media={media.get(business.id)} service={service} currency={currency} favorite={favorites.includes(business.id)} onFavorite={onToggleFavorite} onOpen={onOpenBusiness} />); })()}</div></div> : null}
        {assistBusinesses.length ? <div><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Spotly Assist · independent shopping</p><h3 className="mt-1 text-lg font-semibold">{service === "shop" ? "Request a price check from a local shop" : "Choose a restaurant, request a price check"}</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-secondary">Spotly shops independently. Independent businesses have not been represented as participating merchants; prices are estimates until confirmed for your request.</p></div><span className="text-xs font-medium text-secondary">Assisted requests</span></div><div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{(() => { const listed=assistBusinesses.slice(0,12);const media=marketplaceMediaSet(listed);return listed.map(business=><BusinessCard key={business.id} business={business} media={media.get(business.id)} service={service} currency={currency} favorite={favorites.includes(business.id)} onFavorite={onToggleFavorite} onOpen={onOpenBusiness}/>); })()}</div></div> : null}
        {service==="eat" && /harare/i.test(location.city||"") && !query && <section aria-label="Source menus from The Menu" className="overflow-hidden rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)]">
          <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="experience-menu-art" data-service="eat"><ServiceArtwork service="eat" compact /><span>Menus around you</span></div>
            <div className="p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">New · Restaurant menu discovery</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-.035em]">Explore menus around Harare</h3>
              <p className="mt-2 text-sm leading-6 text-secondary">Independent restaurant information sourced from <a href="https://themenu.co.zw/" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">The Menu</a> under a content-use permission. Prices are source listings, not guaranteed Spotly checkout prices or claims of restaurant affiliation.</p>
              <div className="mt-5 grid items-start gap-3 sm:grid-cols-2">{THEMENU_RESTAURANT_SPOTLIGHTS.map(item=><div key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
                <p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.category} · {item.area}</p>
                <p className="mt-3 text-sm text-[var(--text)]">{item.menuHighlight}</p><p className="mt-1 text-xs font-medium text-secondary">{themenuPriceLabel(item)||"Check the source for current prices"}</p>
                <details className="group mt-4 border-t border-[var(--border)] pt-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--accent)]">Preview {item.menuItems.length} dishes and source-listed prices <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-90">›</span></summary>
                  <ul className="mt-3 divide-y divide-[var(--border-subtle)]">{item.menuItems.map(dish=><li key={dish.name} className="flex items-start justify-between gap-3 py-2 text-xs"><span className="min-w-0 leading-5">{dish.name}</span><span className="shrink-0 font-semibold tabular-nums">{themenuPriceLabel(item)?"US$"+dish.price.toFixed(2):"Check price"}</span></li>)}</ul>
                  <p className="mt-2 text-[11px] leading-5 text-secondary">Illustrative source listing, not verified stock or a Spotly sales offer. Prices require reconfirmation.</p>
                </details>
                <a href={item.listingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)] hover:underline">Open The Menu’s source listing <ArrowRight className="h-3.5 w-3.5"/></a>
              </div>)}</div>
              <p className="mt-3 text-xs leading-5 text-[var(--text-3)]">The Menu information captured 21 October 2026. Confirm availability and price directly before purchase; independent Spotly Assist checkout is offered only where separately enabled.</p>
            </div>
          </div>
        </section>}
        {directoryBusinesses.length ? <section aria-label="More places to explore" className="border-t border-[var(--border-subtle)] pt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">Explore the city</p>
              <h3 className="mt-1 text-xl font-semibold tracking-[-.03em]">{service === "shop" ? "More shops in" : service === "eat" ? "More places to eat in" : service === "book" ? "Discover services in" : "More venues in"} {location.city || "your city"}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-secondary">Independent places for discovery. Where shopping or booking is available, those services appear above this directory.</p>
            </div><span className="text-xs font-medium text-tertiary">{directoryBusinesses.length} listings</span>
          </div>
          <div className="grid min-w-0 grid-cols-1 auto-rows-fr gap-3 md:grid-cols-2">{directoryBusinesses.slice(0,18).map(business=><DirectoryListingRow key={business.id} business={business} favorite={favorites.includes(business.id)} onFavorite={onToggleFavorite} onOpen={onOpenBusiness}/>)}</div>
        </section> : null}
      </div> : <div className="experience-service-empty">
        <ServiceArtwork service={service} compact />
        <div><p className="experience-eyebrow">{isFiltered ? "A little wider search?" : "Growing around you"}</p><h3>{isFiltered ? "Nothing matches this search yet." : `${config.label} is taking shape in ${location.city || "your city"}.`}</h3><p>{isFiltered ? "Try a different search or clear your filters to explore the published places." : "Places and offerings will appear as they’re published. Explore another service or choose a different city in the meantime."}</p><div className="experience-empty-actions">{isFiltered ? <Button onClick={() => { setFilter("all"); setCategory("all"); setProductDepartment("all"); setQuery(""); }}>Clear filters</Button> : <Button onClick={onLocation}>Change city</Button>}<Button variant="outline" onClick={onSearchAll}>Search Spotly</Button></div></div>
      </div>}

    </section>

    {featured.length > 0 && !query ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-8"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Featured on Spotly</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">Worth a look</h2></div><span className="text-xs text-[var(--text-3)]">Published businesses</span></div><div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">{featured.map((business) => <button type="button" key={business.id} onClick={() => onOpenBusiness(business)} className="w-[230px] shrink-0 text-left"><div className="relative aspect-[1.4/1] overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-2)]">{imageForBusiness(business) ? <Image src={imageForBusiness(business)} alt="" fill className="object-cover transition duration-300 hover:scale-[1.02]" sizes="230px" /> : <div className="flex h-full items-center justify-center text-[var(--accent)]"><Store className="h-7 w-7" /></div>}</div><p className="mt-3 truncate text-sm font-semibold">{business.name}</p><p className="mt-1 truncate text-xs text-[var(--text-3)]">{marketplaceProfile(business).displayCategory} · {business.area || business.city}</p></button>)}</div></section> : null}

    {hasInventory || loading ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Across {config.label}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{config.items}</h2><p className="mt-1 text-sm text-[var(--text-3)]">{loading ? "Refreshing published offerings…" : `${feed.totalItems || 0} published ${feed.totalItems === 1 ? "offering" : "offerings"}`}</p></div><SortControl value={sort} onChange={setSort} events={service === "events"} /></div>
      {loading && !feed.items.length ? <div className="mt-5"><ServiceSkeleton /></div> : visibleItems.length ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleItems.map((item) => <ItemCard key={item.id} item={item} service={service} currency={currency} saved={isSaved(item)} onOpen={onOpenItem} onSave={onToggleSaved} />)}</div>{feed.nextOffset != null ? <div className="mt-6 flex justify-center"><Button variant="outline" loading={loadingMore} onClick={loadMore}>Load more</Button></div> : null}</> : <EmptyState className="mt-5" icon={service === "events" ? Ticket : service === "book" ? CalendarDays : ShoppingBag} title={`No ${config.items.toLowerCase()} match these filters`} description="Change the filters or search for something else. Spotly only shows offerings that businesses have actually published." action={<Button onClick={() => { setFilter("all"); setCategory("all"); setProductDepartment("all"); setQuery(""); }}>Show everything</Button>} />}
    </section> : null}

    {error && (feed.businesses.length || feed.items.length) ? <div role="status" className="mt-6 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]">Some {config.label} results could not refresh. The last loaded results are still shown.</div> : null}
  </div>;
}
