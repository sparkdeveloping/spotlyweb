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
  MapPin,
  PackageCheck,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Ticket,
  Truck,
  UtensilsCrossed
} from "lucide-react";
import { loadServiceFeed, track } from "@/lib/firebase-services";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { Badge, Button, EmptyState, SearchField } from "@/components/ui";
import { MARKETPLACE_SERVICES } from "@/components/marketplace-home";

const SERVICE_CONFIG = {
  eat: {
    label: "Eat",
    eyebrow: "Food around you",
    title: "What are you craving?",
    description: "Order from live restaurants and food businesses, with pickup or delivery where each location supports it.",
    search: "Search dishes, restaurants or cuisines",
    businesses: "Restaurants near you",
    items: "Popular dishes",
    icon: UtensilsCrossed,
    suggestions: ["Chicken", "Pizza", "Coffee", "Lunch", "Dessert"]
  },
  shop: {
    label: "Shop",
    eyebrow: "Stores and essentials",
    title: "Find what you need nearby",
    description: "Browse live products across Spotly stores, then open the exact business location for stock, pickup and delivery.",
    search: "Search products, brands or stores",
    businesses: "Stores near you",
    items: "Products to explore",
    icon: ShoppingBag,
    suggestions: ["Groceries", "Pharmacy", "Home", "Fashion", "Gifts"]
  },
  book: {
    label: "Book",
    eyebrow: "Services, stays and activities",
    title: "Make time for something",
    description: "Discover published services and bookable experiences, then send a real request that stays in Activity.",
    search: "Search massage, salon, fitness, stays…",
    businesses: "Bookable places",
    items: "Services and experiences",
    icon: Sparkles,
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
    icon: Ticket,
    suggestions: ["Tonight", "Weekend", "Music", "Food", "Markets"]
  }
};

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
  const value = Number(item?.prices?.[currency] ?? (item?.currency === currency || !item?.currency ? item?.price : item?.price));
  return Number.isFinite(value) && value > 0 ? formatCurrency(value, currency || item?.currency || "USD") : value === 0 ? "Free" : "";
}

function imageForBusiness(business) {
  return business.coverImage || business.image || business.logoUrl || business.logo || "";
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
  return <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
    <button type="button" onClick={onHome} className="shrink-0 px-3 py-3 text-sm font-semibold text-[var(--text-3)] hover:text-[var(--text)]">Home</button>
    {MARKETPLACE_SERVICES.map((item) => <button key={item.key} type="button" onClick={() => onSelectService(item.key)} className={cn("relative shrink-0 px-3 py-3 text-sm font-semibold", item.key === service ? "text-[var(--text)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>{item.label}</button>)}
  </div>;
}

function ServiceSkeleton() {
  return <div className="space-y-8" aria-label="Loading service">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-[22px] bg-[var(--surface)]"><div className="aspect-[16/10] bg-[var(--surface-2)]"/><div className="space-y-3 p-5"><div className="h-4 w-2/3 rounded bg-[var(--surface-2)]"/><div className="h-3 w-1/2 rounded bg-[var(--surface-2)]"/><div className="h-3 w-full rounded bg-[var(--surface-2)]"/></div></div>)}</div>
  </div>;
}

function BusinessCard({ business, favorite, onFavorite, onOpen, service, currency }) {
  const image = imageForBusiness(business);
  const operation = business.operational || {};
  return <article className="group overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface)] transition hover:-translate-y-0.5 hover:shadow-card">
    <button type="button" onClick={() => onOpen(business)} className="block w-full text-left">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-2)]">
        {image ? <Image src={image} alt="" fill  className="object-cover transition duration-300 group-hover:scale-[1.02]" sizes="(max-width: 768px) 100vw, 33vw" /> : <div className="flex h-full items-center justify-center text-[var(--accent)]"><Store className="h-9 w-9" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">{business.isFeatured ? <Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">Featured</Badge> : null}{operation.openNow ? <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0">Open now</Badge> : null}{business.promotion ? <Badge className="bg-[var(--accent)] text-[var(--on-accent)] ring-0">{business.promotion.name || "Offer"}</Badge> : null}</div>
          {business.rating ? <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--media-ink)_58%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--media-text)]"><Star className="h-3.5 w-3.5 fill-current" />{business.rating.toFixed(1)}</span> : null}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="truncate text-lg font-semibold tracking-[-.025em]">{business.name}</h3><p className="mt-1 truncate text-sm text-[var(--text-3)]">{business.category}{business.area || business.city ? ` · ${business.area || business.city}` : ""}</p></div><ChevronRight className="mt-1 h-5 w-5 text-[var(--text-3)]" /></div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-2)]">
          {operation.deliveryAvailable ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1.5"><Truck className="h-3.5 w-3.5" />Delivery{operation.deliveryFeeFrom > 0 ? ` from ${formatCurrency(operation.deliveryFeeFrom, currency || "USD")}` : ""}</span> : null}
          {operation.pickupAvailable ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1.5"><PackageCheck className="h-3.5 w-3.5" />{pickupTimeLabel(operation.earliestPickup) || "Pickup"}</span> : null}
          {operation.locationCount ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1.5"><MapPin className="h-3.5 w-3.5" />{operation.locationCount} {operation.locationCount === 1 ? "location" : "locations"}</span> : null}
        </div>
        {service === "book" ? <p className="mt-4 text-sm text-[var(--text-2)]">Open this business to choose a published service, stay or activity and request a time.</p> : null}
      </div>
    </button>
    <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3"><Button size="sm" className="flex-1" onClick={() => onOpen(business)}>{service === "eat" ? "View menu" : service === "shop" ? "Shop" : service === "book" ? "View services" : "View events"}</Button><Button size="icon" variant="outline" onClick={() => onFavorite(business.id)} aria-label={favorite ? "Remove from saved" : "Save business"}><Heart className={cn("h-4.5 w-4.5", favorite && "fill-[var(--danger)] text-[var(--danger)]")} /></Button></div>
  </article>;
}

function ItemCard({ item, service, currency, saved, onOpen, onSave }) {
  const image = item.image;
  const price = money(item, currency);
  const event = service === "events";
  const book = service === "book";
  const deal = Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0;
  return <article className="group overflow-hidden rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] transition hover:-translate-y-0.5 hover:shadow-card">
    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
        {image ? <Image src={image} alt="" fill  className="object-cover transition duration-300 group-hover:scale-[1.025]" sizes="(max-width: 640px) 50vw, 260px" /> : <div className="flex h-full items-center justify-center text-[var(--accent)]">{event ? <Ticket className="h-8 w-8" /> : book ? <CalendarDays className="h-8 w-8" /> : <ShoppingBag className="h-8 w-8" />}</div>}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">{item.isFeatured ? <Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">Featured</Badge> : null}{deal ? <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0"><Tag className="mr-1 h-3 w-3" />Deal</Badge> : null}{item.promotion ? <Badge className="bg-[var(--accent)] text-[var(--on-accent)] ring-0">{item.promotion.name || "Offer"}</Badge> : null}</div>
      </div>
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[var(--text-3)]">{item.businessName || item.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-5 tracking-[-.015em]">{item.name}</h3>
        {event ? <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--text-2)]"><Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />{eventDateLabel(item.startsAt)}</p> : null}
        {book && item.durationMinutes > 0 ? <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-3)]"><Clock3 className="h-3.5 w-3.5" />{item.durationMinutes} min</p> : null}
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-semibold">{price || (book ? "Price on request" : "Open for details")}</span>{event && item.remainingCapacity !== null ? <span className="text-[11px] text-[var(--text-3)]">{item.remainingCapacity} left</span> : null}</div>
      </div>
    </button>
    <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-2"><button type="button" onClick={() => onOpen(item)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">{event ? "Tickets" : book ? "Book" : "View"}<ArrowRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onSave(item)} className={cn("flex h-8 w-8 items-center justify-center rounded-full", saved ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--text-3)] hover:bg-[var(--surface-hover)]")} aria-label={saved ? "Remove from saved" : "Save"}><Heart className={cn("h-4 w-4", saved && "fill-current")} /></button></div>
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
  const Icon = config.icon;
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
    const controller = new AbortController();
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
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
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

  const itemFilterMatches = useMemo(() => feed.items.filter((item) => service === "events" ? filterEvent(item, filter) : filter === "deals" ? ((Number(item.compareAtPrice || 0) > Number(item.price || 0) && Number(item.price || 0) > 0) || Boolean(item.promotion)) : true).filter((item) => category === "all" || item.category === category), [feed.items, filter, category, service]);
  const itemBusinessIds = useMemo(() => new Set(itemFilterMatches.map((item) => item.businessId)), [itemFilterMatches]);
  const visibleBusinesses = useMemo(() => feed.businesses.filter((business) => filterBusiness(business, filter)).filter((business) => category === "all" || [business.category, ...(business.categories || [])].includes(category) || itemBusinessIds.has(business.id)).filter((business) => !["deals", "today", "tonight", "weekend", "free"].includes(filter) || itemBusinessIds.has(business.id)), [feed.businesses, filter, category, itemBusinessIds]);
  const visibleItems = useMemo(() => sortItems(itemFilterMatches, sort, service, currency), [itemFilterMatches, sort, service, currency]);
  const featured = visibleBusinesses.filter((business) => business.isFeatured).slice(0, 4);
  const recentOrder = orders.find((order) => visibleBusinesses.some((business) => business.id === order.businessId));
  const recentBusiness = recentOrder ? visibleBusinesses.find((business) => business.id === recentOrder.businessId) : null;
  const isSaved = (item) => savedItems.some((saved) => saved.type === item.type && saved.entityId === item.id);
  const filterOptions = service === "events"
    ? [{ key: "all", label: "All" }, { key: "today", label: "Today" }, { key: "tonight", label: "Tonight" }, { key: "weekend", label: "Weekend" }, { key: "free", label: "Free" }]
    : service === "book"
      ? [{ key: "all", label: "All" }, { key: "open", label: "Open now" }]
      : [{ key: "all", label: "All" }, { key: "delivery", label: `Delivery${feed.facets?.delivery ? ` ${feed.facets.delivery}` : ""}` }, { key: "pickup", label: `Pickup${feed.facets?.pickup ? ` ${feed.facets.pickup}` : ""}` }, { key: "open", label: `Open now${feed.facets?.openNow ? ` ${feed.facets.openNow}` : ""}` }, { key: "deals", label: `Deals${feed.facets?.deals ? ` ${feed.facets.deals}` : ""}` }];

  return <div>
    <section className="overflow-hidden rounded-[28px] bg-[var(--surface)]">
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><Icon className="h-4 w-4" />{config.eyebrow}</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-[42px] sm:leading-[1.05]">{config.title}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-2)] sm:text-base">{config.description}</p></div>
          <button type="button" onClick={onLocation} className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold hover:bg-[var(--surface-hover)]"><MapPin className="h-4 w-4 text-[var(--accent)]" />{location.area || location.city}<ChevronRight className="h-4 w-4 text-[var(--text-3)]" /></button>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"><SearchField value={query} onChange={setQuery} label={`Search ${config.label}`} placeholder={config.search} inputProps={{ autoComplete: "off" }} /><Button variant="outline" className="lg:self-end" onClick={onSearchAll}><Search className="h-4 w-4" />Search all Spotly</Button></div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">{config.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { if (service === "events" && suggestion === "Tonight") { setQuery(""); setFilter("tonight"); } else if (service === "events" && suggestion === "Weekend") { setQuery(""); setFilter("weekend"); } else { setQuery(suggestion); } }} className="shrink-0 rounded-full bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-hover)]">{suggestion}</button>)}</div>
      </div>
      <ServiceTabs service={service} onSelectService={onSelectService} onHome={onHome} />
    </section>

    {recentBusiness ? <section className="mt-5 flex flex-col gap-3 rounded-[22px] bg-[var(--accent-soft)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--accent)]"><Clock3 className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--accent-strong)]">Again</p><p className="mt-1 text-sm font-semibold">{service === "book" ? "Return to" : service === "events" ? "See what’s new from" : "Order again from"} {recentBusiness.name}</p></div></div><div className="flex gap-2"><Button size="sm" onClick={() => onOpenBusiness(recentBusiness)}>Open</Button><Button size="sm" variant="ghost" onClick={onActivity}>Activity</Button></div></section> : null}

    <section className="mt-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{config.label} in {location.area || location.city}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{query ? `Results for “${query}”` : config.businesses}</h2><p className="mt-1 text-sm text-[var(--text-3)]">{feed.totalBusinesses || 0} live {feed.totalBusinesses === 1 ? "business" : "businesses"}</p></div><div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">{filterOptions.map((option) => <button key={option.key} type="button" onClick={() => setFilter(option.key)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-semibold", filter === option.key ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface)] text-[var(--text-2)]")}>{option.label}</button>)}</div></div>

      {feed.categories?.length ? <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCategory("all")} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", category === "all" ? "bg-[var(--text)] text-[var(--background)]" : "bg-[var(--surface)] text-[var(--text-2)]")}>All categories</button>{feed.categories.slice(0, 18).map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold", category === item ? "bg-[var(--text)] text-[var(--background)]" : "bg-[var(--surface)] text-[var(--text-2)]")}>{item}</button>)}</div> : null}

      {loading ? <div className="mt-5"><ServiceSkeleton /></div> : error && !feed.businesses.length ? <EmptyState className="mt-5" icon={Search} title={`${config.label} is temporarily unavailable`} description={error} action={<Button variant="outline" onClick={() => setQuery((value) => `${value} `)}>Try again</Button>} /> : visibleBusinesses.length ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleBusinesses.slice(0, 12).map((business) => <BusinessCard key={business.id} business={business} service={service} currency={currency} favorite={favorites.includes(business.id)} onFavorite={onToggleFavorite} onOpen={onOpenBusiness} />)}</div> : <EmptyState className="mt-5" icon={Store} title={`No matching ${config.label.toLowerCase()} businesses`} description="Try another filter, category or search, or broaden your location." action={<Button onClick={() => { setFilter("all"); setCategory("all"); setQuery(""); }}>Clear filters</Button>} />}
    </section>

    {featured.length > 0 && !query ? <section className="mt-9 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">Featured on Spotly</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">Worth a look</h2></div><span className="text-xs text-[var(--text-3)]">Published businesses</span></div><div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">{featured.map((business) => <button type="button" key={business.id} onClick={() => onOpenBusiness(business)} className="w-[230px] shrink-0 text-left"><div className="relative aspect-[1.4/1] overflow-hidden rounded-[18px] bg-[var(--surface-2)]">{imageForBusiness(business) ? <Image src={imageForBusiness(business)} alt="" fill  className="object-cover" sizes="230px" /> : <div className="flex h-full items-center justify-center text-[var(--accent)]"><Store className="h-7 w-7" /></div>}</div><p className="mt-3 truncate text-sm font-semibold">{business.name}</p><p className="mt-1 truncate text-xs text-[var(--text-3)]">{business.category} · {business.area || business.city}</p></button>)}</div></section> : null}

    <section className="mt-9">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Across {config.label}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.035em]">{config.items}</h2><p className="mt-1 text-sm text-[var(--text-3)]">{feed.totalItems || 0} published {feed.totalItems === 1 ? "offering" : "offerings"}</p></div><select value={sort} onChange={(event) => setSort(event.target.value)} className="field-control h-10 min-w-[150px] self-start text-sm sm:self-auto"><option value="recommended">Recommended</option>{service === "events" ? <option value="soonest">Soonest</option> : null}<option value="price">Price: low to high</option></select></div>
      {loading && !feed.items.length ? <div className="mt-5"><ServiceSkeleton /></div> : visibleItems.length ? <><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleItems.map((item) => <ItemCard key={item.id} item={item} service={service} currency={currency} saved={isSaved(item)} onOpen={onOpenItem} onSave={onToggleSaved} />)}</div>{feed.nextOffset != null ? <div className="mt-6 flex justify-center"><Button variant="outline" loading={loadingMore} onClick={loadMore}>Load more</Button></div> : null}</> : <EmptyState className="mt-5" icon={service === "events" ? Ticket : service === "book" ? CalendarDays : ShoppingBag} title={`No ${config.items.toLowerCase()} match these filters`} description="Try another category or clear the current filters." action={<Button onClick={() => { setFilter("all"); setCategory("all"); setQuery(""); }}>Show everything</Button>} />}
    </section>

    {error && (feed.businesses.length || feed.items.length) ? <div role="status" className="mt-6 rounded-[18px] border border-[color-mix(in_srgb,var(--warning)_30%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]">Some {config.label} results could not refresh. The last loaded results are still shown.</div> : null}
  </div>;
}
