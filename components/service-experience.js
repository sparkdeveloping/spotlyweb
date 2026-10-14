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
import { MARKETPLACE_SERVICES } from "@/components/marketplace-home";
import { ServiceArtwork, ServiceGlyph } from "@/components/service-artwork";
import { MarketplaceTrustBadge } from "@/components/marketplace-trust-ui";
import { marketplaceMedia, marketplaceMediaSet } from "@/lib/marketplace-editorial";
import { marketplaceActionLabel, marketplaceProfile } from "@/lib/marketplace-taxonomy";

const SERVICE_CONFIG = {
  eat: {
    label: "Eat",
    eyebrow: "Food around you",
    title: "What are you craving?",
    description: "Discover food businesses around you. Menus, ordering, pickup and delivery only appear where the merchant has enabled them.",
    search: "Search dishes, restaurants or cuisines",
    businesses: "Restaurants to explore",
    items: "Popular dishes",
    suggestions: ["Chicken", "Pizza", "Coffee", "Lunch", "Dessert"]
  },
  shop: {
    label: "Shop",
    eyebrow: "Stores and essentials",
    title: "Find what you need nearby",
    description: "Discover local shops and grocery products. Price, stock, pickup and delivery only appear where a merchant has published a verified offer.",
    search: "Search products, brands or stores",
    businesses: "Stores to explore",
    items: "Products to explore",
    suggestions: ["Groceries", "Pharmacy", "Home", "Fashion", "Gifts"]
  },
  book: {
    label: "Book",
    eyebrow: "Services, stays and activities",
    title: "Make time for something",
    description: "Discover services and experiences with real businesses, then request a time and keep the plan in Activity.",
    search: "Search massage, salon, fitness, stays…",
    businesses: "Bookable places",
    items: "Services and experiences",
    suggestions: ["Massage", "Salon", "Fitness", "Activities", "Stay"]
  },
  events: {
    label: "Events",
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

function ServiceTabs({ service, onSelectService, onHome }) {
  return <nav aria-label="Spotly services" className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto pb-1">
    <button type="button" onClick={onHome} className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-[var(--text-3)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">Home</button>
    {MARKETPLACE_SERVICES.map((item) => <button key={item.key} type="button" onClick={() => onSelectService(item.key)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition", item.key === service ? "bg-[var(--text)] text-[var(--background)]" : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]")}><ServiceGlyph service={item.key} className="h-4 w-4" />{item.label}</button>)}
  </nav>;
}

function SkeletonBlock({ className }) {
  return <div className={cn("v7-skeleton rounded-[var(--radius-card)]", className)} aria-hidden="true" />;
}

function ServiceSkeleton() {
  return <div className="space-y-6" aria-label="Loading service results" aria-busy="true">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)]"><SkeletonBlock className="aspect-[16/10] rounded-none"/><div className="space-y-3 p-4"><SkeletonBlock className="h-5 w-2/3"/><SkeletonBlock className="h-4 w-1/2"/><SkeletonBlock className="h-4 w-full"/></div></div>)}</div>
  </div>;
}

function BusinessCard({ business, media: assignedMedia, favorite, onFavorite, onOpen, service, currency }) {
  const profile = marketplaceProfile(business);
  const media = assignedMedia || mediaForBusiness(business);
  const image = media.src;
  const operation = business.operational || {};
  const commerce = profile.cardMode === "commerce";
  const action = marketplaceActionLabel(business, service);
  return <article className={cn("group relative overflow-hidden rounded-[var(--radius-card)] border bg-[var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card", commerce ? "border-[var(--border-subtle)]" : "border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)]")}>
    <button type="button" onClick={() => onOpen(business)} className="block w-full text-left">
      <div className={cn("relative overflow-hidden", commerce ? "aspect-[16/10] bg-[var(--surface-2)]" : "aspect-[16/9] bg-[var(--surface-2)]")}>
        {image ? <Image src={image} alt="" fill className="object-cover transition duration-300 group-hover:scale-[1.025]" sizes="(max-width: 768px) 100vw, 33vw" /> : <div className="flex h-full flex-col justify-end bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-2)_62%,var(--surface))] p-5"><span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface)] text-[var(--accent)] shadow-sm"><Store className="h-5 w-5" /></span><p className="mt-8 max-w-[80%] text-lg font-semibold tracking-[-.025em] text-[var(--text)]">{profile.displayCategory}</p><p className="mt-1 text-xs text-[var(--text-3)]">Spotly directory</p></div>}
        {image ? <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" /> : null}
        {image && media.kind === "editorial" ? <span title="Editorial category image — not supplied by this business" aria-label="Editorial category image" className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-[var(--media-text)] backdrop-blur"><Info className="h-3.5 w-3.5" /></span> : null}
        {commerce && image ? <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">{business.isFeatured ? <Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">Featured</Badge> : null}<MarketplaceTrustBadge business={business} compact />{operation.openNow ? <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0">Open now</Badge> : null}{business.promotion ? <Badge className="bg-[var(--accent)] text-[var(--on-accent)] ring-0">{business.promotion.name || "Offer"}</Badge> : null}</div> : null}
      </div>
      <div className={cn("p-4", !commerce && "pb-3")}>
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="truncate text-[17px] font-semibold tracking-[-.025em]">{business.name}</h3><p className="mt-1 truncate text-sm text-[var(--text-3)]">{profile.displayCategory}{business.area || business.city ? ` · ${business.area || business.city}` : ""}</p></div><ChevronRight className="mt-1 h-5 w-5 text-[var(--text-3)]" /></div>
        {commerce ? <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-[var(--text-2)]">
          {operation.deliveryAvailable ? <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Delivery{operation.deliveryFeeFrom > 0 ? ` from ${formatCurrency(operation.deliveryFeeFrom, currency || "USD")}` : ""}</span> : null}
          {operation.pickupAvailable ? <span className="inline-flex items-center gap-1.5"><PackageCheck className="h-3.5 w-3.5" />{pickupTimeLabel(operation.earliestPickup) || "Pickup"}</span> : null}
          {operation.locationCount ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{operation.locationCount} {operation.locationCount === 1 ? "location" : "locations"}</span> : null}
        </div> : <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--text-3)]">Directory listing · commerce not enabled</span><span className="font-semibold text-[var(--accent)]">{action} <span aria-hidden="true">→</span></span></div>}
        {commerce ? <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">{action}<ArrowRight className="h-3.5 w-3.5" /></div> : null}
      </div>
    </button>
    <button type="button" onClick={() => onFavorite(business.id)} aria-label={favorite ? "Remove from saved" : "Save business"} className={cn("absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/35 text-[var(--media-text)] backdrop-blur transition hover:bg-black/50", favorite && "bg-[var(--surface)] text-[var(--danger)]")}><Heart className={cn("h-4 w-4", favorite && "fill-current")} /></button>
  </article>;
}

function ItemCard({ item, service, currency, saved, onOpen, onSave }) {
  const image = item.image;
  const price = money(item, currency);
  const event = service === "events";
  const book = service === "book";
  const deal = Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0;
  return <article className="group overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card">
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
    <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-2"><button type="button" onClick={() => onOpen(item)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">{event ? "Tickets" : book ? "Book" : "View"}<ArrowRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onSave(item)} className={cn("flex h-8 w-8 items-center justify-center rounded-full transition", saved ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--text-3)] hover:bg-[var(--surface-hover)]")} aria-label={saved ? "Remove from saved" : "Save"}><Heart className={cn("h-4 w-4", saved && "fill-current")} /></button></div>
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
  return <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[var(--radius-control)] bg-[var(--surface-2)] p-1" aria-label="Sort results">{options.map((option) => <button key={option.value} type="button" onClick={() => onChange(option.value)} className={cn("shrink-0 rounded-[10px] px-3 py-2 text-xs font-semibold transition", value === option.value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-3)] hover:text-[var(--text)]")}>{option.label}</button>)}</div>;
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
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState(service === "events" ? "soonest" : "recommended");

  useEffect(() => {
    setQuery("");
    setCategory("all");
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
  }, [service, location.city, location.area, query, config.label]);

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
  const itemFilterMatches = useMemo(() => feed.items.filter((item) => service === "events" ? filterEvent(item, filter) : filter === "deals" ? ((Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0) || Boolean(item.promotion)) : true).filter((item) => category === "all" || service === "shop" || item.category === category), [feed.items, filter, category, service]);
  const itemBusinessIds = useMemo(() => new Set(itemFilterMatches.map((item) => item.businessId)), [itemFilterMatches]);
  const visibleBusinesses = useMemo(() => feed.businesses.filter((business) => filterBusiness(business, filter)).filter((business) => {
    if (category === "all") return true;
    if (service === "shop") return marketplaceProfile(business).vertical === category;
    return [business.category, ...(business.categories || [])].includes(category) || itemBusinessIds.has(business.id);
  }).filter((business) => !["deals", "today", "tonight", "weekend", "free"].includes(filter) || itemBusinessIds.has(business.id)), [feed.businesses, filter, category, itemBusinessIds, service]);
  const visibleItems = useMemo(() => sortItems(itemFilterMatches, sort, service, currency), [itemFilterMatches, sort, service, currency]);
  const commerceBusinesses = useMemo(() => visibleBusinesses.filter((business) => marketplaceProfile(business).cardMode === "commerce"), [visibleBusinesses]);
  const directoryBusinesses = useMemo(() => visibleBusinesses.filter((business) => marketplaceProfile(business).cardMode !== "commerce"), [visibleBusinesses]);
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
  const localityLabel = hasPreciseLocation ? "Near you" : `Popular in ${location.city || "your city"}`;

  return <div className="v7-page-enter pb-8">
    <section className={cn("relative overflow-hidden rounded-[var(--radius-feature)] px-5 py-6 text-[var(--service-foreground)] sm:px-7 sm:py-8", `service-surface-${service}`)}>
      <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[color-mix(in_srgb,var(--service-foreground)_78%,transparent)]"><ServiceGlyph service={service} className="h-4 w-4" />{config.eyebrow}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-[44px] sm:leading-[1.04]">{config.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[color-mix(in_srgb,var(--service-foreground)_78%,transparent)] sm:text-base">{config.description}</p>
          <div className="mt-6 max-w-2xl rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] p-2 shadow-lg backdrop-blur">
            <SearchField value={query} onChange={setQuery} label={`Search ${config.label}`} placeholder={config.search} inputProps={{ autoComplete: "off" }} />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">{config.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { if (service === "events" && suggestion === "Tonight") { setQuery(""); setFilter("tonight"); } else if (service === "events" && suggestion === "Weekend") { setQuery(""); setFilter("weekend"); } else { setQuery(suggestion); } }} className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--service-foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--service-foreground)_12%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--service-foreground)] transition hover:bg-[color-mix(in_srgb,var(--service-foreground)_20%,transparent)]">{suggestion}</button>)}</div>
        </div>
        <ServiceArtwork service={service} className="absolute -bottom-8 -right-2 hidden opacity-95 sm:block lg:static lg:mx-auto lg:h-44 lg:w-44" />
      </div>
    </section>

    <div className="mt-4 flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4 lg:flex-row lg:items-center lg:justify-between">
      <ServiceTabs service={service} onSelectService={onSelectService} onHome={onHome} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-3)]">
        <button type="button" onClick={onLocation} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 font-semibold transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />{location.area || location.city || "Choose location"}</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onSearchAll} className="font-semibold text-[var(--text-2)] hover:text-[var(--accent)]">Search all Spotly</button>
      </div>
    </div>

    {recentBusiness ? <section className="mt-5 flex flex-col gap-3 border-y border-[var(--border-subtle)] py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-soft)] text-[var(--accent)]"><Clock3 className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-[var(--accent)]">Again</p><p className="mt-1 text-sm font-semibold">{service === "book" ? "Return to" : service === "events" ? "See what’s new from" : "Order again from"} {recentBusiness.name}</p></div></div><div className="flex gap-2"><Button size="sm" onClick={() => onOpenBusiness(recentBusiness)}>Open</Button><Button size="sm" variant="ghost" onClick={onActivity}>Activity</Button></div></section> : null}

    <section className="mt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{localityLabel}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{query ? `Results for “${query}”` : config.businesses}</h2><p className="mt-1 text-sm text-[var(--text-3)]">{visibleBusinesses.length} {visibleBusinesses.length === 1 ? "place" : "places"}{commerceBusinesses.length ? ` · ${commerceBusinesses.length} available on Spotly` : " · directory discovery"}</p></div><div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">{filterOptions.map((option) => <button key={option.key} type="button" onClick={() => setFilter(option.key)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition", filter === option.key ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>{option.label}</button>)}</div></div>

      {categoryOptions.length ? <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategory("all")} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", category === "all" ? "bg-[var(--text)] text-[var(--background)]" : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>All categories</button>{categoryOptions.slice(0, 24).map((item) => <button type="button" key={item.key} onClick={() => setCategory(item.key)} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", category === item.key ? "bg-[var(--text)] text-[var(--background)]" : "bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>{item.label}</button>)}</div> : null}

      {loading ? <div className="mt-5"><ServiceSkeleton /></div> : error && !feed.businesses.length ? <EmptyState className="mt-5" icon={Search} title={`${config.label} is temporarily unavailable`} description="Spotly could not refresh this service right now. Your other services and Activity are still available." action={<Button variant="outline" onClick={() => setQuery((value) => `${value} `)}>Try again</Button>} /> : visibleBusinesses.length ? <div className="mt-6 space-y-10">
        {commerceBusinesses.length ? <div><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Available on Spotly</p><h3 className="mt-1 text-lg font-semibold tracking-[-.025em]">Ready for {service === "book" ? "booking" : service === "events" ? "tickets" : service === "eat" ? "ordering" : "shopping"}</h3></div><span className="text-xs text-[var(--text-3)]">Verified commerce</span></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{(() => { const listed = commerceBusinesses.slice(0, 12); const media = marketplaceMediaSet(listed); return listed.map((business) => <BusinessCard key={business.id} business={business} media={media.get(business.id)} service={service} currency={currency} favorite={favorites.includes(business.id)} onFavorite={onToggleFavorite} onOpen={onOpenBusiness} />); })()}</div></div> : null}
        {directoryBusinesses.length ? <div><div className="mb-4"><p className="text-sm font-semibold text-[var(--text-2)]">Explore {service === "shop" ? "stores" : service === "eat" ? "places to eat" : service === "book" ? "services & places" : "venues"} in {location.city || "your city"}</p><p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-3)]">These are discovery listings. Spotly does not show ordering, pickup, booking or ticket actions until the business enables verified commerce.</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{(() => { const listed = directoryBusinesses.slice(0, 18); const media = marketplaceMediaSet(listed); return listed.map((business) => <BusinessCard key={business.id} business={business} media={media.get(business.id)} service={service} currency={currency} favorite={favorites.includes(business.id)} onFavorite={onToggleFavorite} onOpen={onOpenBusiness} />); })()}</div></div> : null}
      </div> : <EmptyState className="mt-5" icon={Store} title={`Nothing matching this ${config.label.toLowerCase()} search yet`} description={`Try another category or broaden the search. Spotly will keep showing what is actually published in ${location.city || "your city"}.`} action={<Button onClick={() => { setFilter("all"); setCategory("all"); setQuery(""); }}>Clear filters</Button>} />}
    </section>

    {featured.length > 0 && !query ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-8"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Featured on Spotly</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">Worth a look</h2></div><span className="text-xs text-[var(--text-3)]">Published businesses</span></div><div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">{featured.map((business) => <button type="button" key={business.id} onClick={() => onOpenBusiness(business)} className="w-[230px] shrink-0 text-left"><div className="relative aspect-[1.4/1] overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-2)]">{imageForBusiness(business) ? <Image src={imageForBusiness(business)} alt="" fill className="object-cover transition duration-300 hover:scale-[1.02]" sizes="230px" /> : <div className="flex h-full items-center justify-center text-[var(--accent)]"><Store className="h-7 w-7" /></div>}</div><p className="mt-3 truncate text-sm font-semibold">{business.name}</p><p className="mt-1 truncate text-xs text-[var(--text-3)]">{marketplaceProfile(business).displayCategory} · {business.area || business.city}</p></button>)}</div></section> : null}

    <section className="mt-10 border-t border-[var(--border-subtle)] pt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Across {config.label}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{config.items}</h2><p className="mt-1 text-sm text-[var(--text-3)]">{feed.totalItems || 0} published {feed.totalItems === 1 ? "offering" : "offerings"}</p></div><SortControl value={sort} onChange={setSort} events={service === "events"} /></div>
      {loading && !feed.items.length ? <div className="mt-5"><ServiceSkeleton /></div> : visibleItems.length ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleItems.map((item) => <ItemCard key={item.id} item={item} service={service} currency={currency} saved={isSaved(item)} onOpen={onOpenItem} onSave={onToggleSaved} />)}</div>{feed.nextOffset != null ? <div className="mt-6 flex justify-center"><Button variant="outline" loading={loadingMore} onClick={loadMore}>Load more</Button></div> : null}</> : <EmptyState className="mt-5" icon={service === "events" ? Ticket : service === "book" ? CalendarDays : ShoppingBag} title={`No ${config.items.toLowerCase()} match these filters`} description="Change the filters or search for something else. Spotly only shows offerings that businesses have actually published." action={<Button onClick={() => { setFilter("all"); setCategory("all"); setQuery(""); }}>Show everything</Button>} />}
    </section>

    {error && (feed.businesses.length || feed.items.length) ? <div role="status" className="mt-6 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]">Some {config.label} results could not refresh. The last loaded results are still shown.</div> : null}
  </div>;
}
