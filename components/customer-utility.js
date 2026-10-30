"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  History,
  MapPin,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Ticket,
  Trash2,
  X
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge, Button, EmptyState, SearchField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { ServiceArtwork, ServiceGlyph } from "@/components/service-artwork";
import { MarketplaceTrustBadge } from "@/components/marketplace-trust-ui";

const typeMeta = {
  business: { label: "Businesses", icon: Store },
  product: { label: "Products", icon: ShoppingBag },
  service: { label: "Services", icon: Sparkles },
  event: { label: "Events", icon: CalendarDays },
  place: { label: "Places", icon: MapPin }
};

const popularIntents = [
  { label: "Food nearby", service: "eat", icon: "eat" },
  { label: "Groceries", service: "shop", icon: "shop" },
  { label: "Massage", service: "book", icon: "book" },
  { label: "This weekend", service: "events", icon: "events" }
];

function money(result) {
  const direct = Number(result.price);
  if (Number.isFinite(direct) && direct > 0) return formatCurrency(direct, result.currency || "USD");
  return "";
}

function SearchResult({ result, onOpen, saved, onSave }) {
  const reduce = useReducedMotion();
  const meta = typeMeta[result.type] || typeMeta.business;
  const Icon = meta.icon;
  return <motion.article layout initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group flex items-center gap-2 border-b border-[var(--border-subtle)] last:border-0">
    <button type="button" onClick={() => onOpen(result)} className="flex min-w-0 flex-1 gap-4 py-4 text-left sm:py-5">
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[var(--surface-2)] text-[var(--accent)] sm:h-[72px] sm:w-[72px]">
        {result.image ? <Image src={result.image} alt="" fill className="object-cover transition duration-300 group-hover:scale-[1.03]" sizes="72px" /> : <Icon className="h-6 w-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold tracking-[-.02em]">{result.title || result.name}</span>{result.type === "business" ? <MarketplaceTrustBadge business={result} compact /> : result.catalogReference ? <Badge tone="info">Product reference</Badge> : <Badge tone="neutral">{meta.label.slice(0, -1)}</Badge>}</span>
        {result.subtitle ? <span className="mt-1 block truncate text-xs text-[var(--text-3)]">{result.subtitle}</span> : null}{result.catalogReference ? <span className="mt-1 block text-xs font-medium text-[var(--accent)]">Catalogue identity · store stock and price not confirmed</span> : null}
        {result.description ? <span className="mt-2 line-clamp-2 block text-sm leading-6 text-[var(--text-2)]">{result.description}</span> : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-3)]">{money(result) ? <strong className="text-[var(--text)]">{money(result)}</strong> : null}{result.city || result.area ? <span>{[result.area, result.city].filter(Boolean).join(" · ")}</span> : null}{result.startsAt ? <span>{new Date(result.startsAt).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" })}</span> : null}</span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)] transition group-hover:translate-x-0.5" />
    </button>
    {result.type !== "place" ? <button type="button" onClick={() => onSave(result)} className={cn("mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition", saved ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-3)] hover:bg-[var(--surface-hover)]")} aria-label={saved ? "Remove from Saved" : "Save"}><Heart className={cn("h-[18px] w-[18px]", saved && "fill-current")} /></button> : null}
  </motion.article>;
}

function IntentTile({ item, onClick }) {
  return <button type="button" onClick={onClick} data-service={item.service} className="experience-intent flex items-center gap-3 rounded-[20px] border px-4 text-left transition hover:shadow-card"><ServiceArtwork service={item.icon} compact /><span className="min-w-0 flex-1 text-sm font-semibold">{item.label}</span><ArrowRight className="h-4 w-4 shrink-0 text-[var(--world-ink)]" aria-hidden="true" /></button>;
}

export function CustomerSearchView({
  query,
  onQuery,
  results = [],
  loading = false,
  error = "",
  filter = "all",
  onFilter,
  counts = {},
  recentSearches = [],
  onRecent,
  onClearRecent,
  onOpenResult,
  onSaveResult,
  isSaved,
  location,
  onLocation,
  service,
  serviceLabel,
  onClearService,
  onExplore
}) {
  const filters = ["all", "business", "product", "service", "event", "place"];
  const visible = filter === "all" ? results : results.filter((item) => item.type === filter);
  return <section className="v7-page-enter mx-auto max-w-[1040px]">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl"><p className="text-sm font-semibold text-[var(--accent)]">Search{service ? ` · ${serviceLabel}` : ""}</p><h1 className="mt-2 text-[34px] font-semibold tracking-[-.05em] sm:text-[44px]">Find anything on Spotly.</h1><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Businesses, products, services, events and places in {location.city} share one search.</p></div>
      <button type="button" onClick={onLocation} className="inline-flex w-fit items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-hover)]"><MapPin className="h-4 w-4 text-[var(--accent)]" />{location.area || location.city}</button>
    </div>

    <div className="sticky top-[84px] z-20 mt-6 rounded-[16px] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] py-2 backdrop-blur-xl"><SearchField value={query} onChange={onQuery} label="Search Spotly" placeholder={service ? `Search ${serviceLabel.toLowerCase()}…` : "Try chicken, massage, airport, groceries…"} inputProps={{ autoFocus: true, autoComplete: "off" }} className="h-14 rounded-[16px] bg-[var(--surface)] shadow-card" /></div>

    {service ? <div className="mt-3 flex"><button type="button" onClick={onClearService} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)]">Searching {serviceLabel}<X className="h-3.5 w-3.5" /></button></div> : null}

    {!query.trim() ? <div className="mt-8 space-y-9">
      {recentSearches.length ? <section><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold tracking-[-.03em]">Recent searches</h2><button type="button" onClick={onClearRecent} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">Clear</button></div><div className="mt-3 divide-y divide-[var(--border-subtle)]">{recentSearches.map((item) => <button type="button" key={item} onClick={() => onRecent(item)} className="flex w-full items-center gap-3 py-3.5 text-left"><History className="h-4 w-4 text-[var(--text-3)]" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{item}</span><ArrowRight className="h-4 w-4 text-[var(--text-3)]" /></button>)}</div></section> : null}
      <section><h2 className="text-xl font-semibold tracking-[-.03em]">Popular searches</h2><p className="mt-1 text-sm text-[var(--text-3)]">Useful shortcuts while you decide what to search for.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{popularIntents.map((item) => <IntentTile key={item.label} item={item} onClick={() => onQuery(item.label.replace(" nearby", ""))} />)}</div></section>
      {!recentSearches.length ? <div className="rounded-[16px] bg-[var(--surface-2)] p-5 sm:p-6"><Search className="h-5 w-5 text-[var(--accent)]" /><h2 className="mt-3 text-lg font-semibold">Search gets better as you use Spotly</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">Your recent searches stay on this device so getting back to something is faster. Try a product, service, business, event or place.</p><Button className="mt-4" variant="outline" onClick={onExplore}>Explore instead</Button></div> : null}
    </div> : <>
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{filters.map((value) => { const meta = value === "all" ? { label: "All", icon: Search } : typeMeta[value]; const Icon = meta.icon; const count = value === "all" ? results.length : counts[value] || 0; return <button key={value} type="button" onClick={() => onFilter(value)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition", filter === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]")}><Icon className="h-4 w-4" />{meta.label}{count ? <span className="text-[11px] opacity-70">{count}</span> : null}</button>; })}</div>
      {loading ? <div className="mt-7 space-y-3">{[0,1,2,3].map((item) => <div key={item} className="flex gap-4 border-b border-[var(--border-subtle)] py-4"><span className="v7-skeleton h-16 w-16 shrink-0 rounded-[16px]"/><span className="flex-1"><span className="v7-skeleton block h-4 w-1/3 rounded-md"/><span className="v7-skeleton mt-3 block h-3 w-2/3 rounded-md"/><span className="v7-skeleton mt-2 block h-3 w-1/2 rounded-md"/></span></div>)}</div> : error ? <EmptyState className="mt-8 rounded-[16px] bg-[var(--surface-2)]" icon={Search} title="Search is temporarily unavailable" description={error} action={<Button variant="outline" onClick={() => onQuery(query)}>Try again</Button>} /> : visible.length ? <div className="mt-7"><div className="mb-2 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-[-.03em]">Best matches</h2><p className="mt-1 text-xs text-[var(--text-3)]">Ranked across Spotly, not just business names.</p></div><span className="text-xs text-[var(--text-3)]">{visible.length} result{visible.length === 1 ? "" : "s"}</span></div><div>{visible.map((result) => <SearchResult key={`${result.type}-${result.entityId || result.id}`} result={result} onOpen={onOpenResult} saved={isSaved(result)} onSave={onSaveResult} />)}</div></div> : <div className="mt-8 rounded-[24px] bg-[var(--surface-2)]"><EmptyState icon={Search} title={`No results for “${query}”`} description={`Nothing matching that is live in ${location.city} right now. Try fewer words, another spelling, or broaden your location.`} action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => onQuery("")}>Try another search</Button><Button variant="outline" onClick={onLocation}>Change location</Button></div>} /></div>}
    </>}
  </section>;
}

const savedIcons = { event: Ticket, service: Sparkles, product: ShoppingBag, place: MapPin, business: Store };

function SavedRow({ item, business, onOpen, onRemove }) {
  const Icon = savedIcons[item.type] || Store;
  return <article className="group border-b border-[var(--border-subtle)] last:border-0"><div className="flex items-center gap-3 py-3.5"><button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[var(--surface-2)] text-[var(--accent)]">{item.image || item.coverImage || item.logoUrl ? <Image src={item.image || item.coverImage || item.logoUrl} alt="" fill className="object-cover" sizes="56px" /> : <Icon className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{item.title || item.name || "Saved item"}</span><span className="mt-1 block line-clamp-1 text-xs text-[var(--text-3)]">{item.subtitle || item.description || [item.area, item.city].filter(Boolean).join(" · ") || typeMeta[item.type]?.label}</span></span><ArrowRight className="h-4 w-4 text-[var(--text-3)]" /></button><button type="button" onClick={onRemove} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[var(--text-3)] opacity-70 transition hover:bg-[var(--surface-hover)] hover:text-[var(--danger)] group-hover:opacity-100" aria-label="Remove from Saved"><Trash2 className="h-4 w-4" /></button></div></article>;
}

export function CustomerSavedView({ user, businessEntries = [], savedItems = [], onOpenBusiness, onOpenSavedItem, onRemoveBusiness, onRemoveItem, onExplore, loginHref }) {
  const [filter, setFilter] = useState("all");
  const sections = [
    { key: "business", label: "Businesses", icon: Store, count: businessEntries.length },
    { key: "product", label: "Products", icon: ShoppingBag, count: savedItems.filter((item) => item.type === "product").length },
    { key: "service", label: "Services", icon: Sparkles, count: savedItems.filter((item) => item.type === "service").length },
    { key: "event", label: "Events", icon: CalendarDays, count: savedItems.filter((item) => item.type === "event").length },
    { key: "place", label: "Places", icon: MapPin, count: savedItems.filter((item) => item.type === "place").length }
  ];
  if (!user || user.isAnonymous) return <section className="mx-auto max-w-[980px]"><p className="text-sm font-semibold text-[var(--accent)]">Saved</p><h1 className="mt-2 text-[34px] font-semibold tracking-[-.05em] sm:text-[44px]">Keep the city you want to come back to.</h1><div className="mt-7 rounded-[24px] bg-[var(--surface-2)]"><EmptyState icon={Heart} title="Sign in to use Saved" description="Save businesses, products, services, events and places across Spotly, then find them here on any device." action={<Button asChild><Link href={loginHref}>Sign in</Link></Button>} /></div></section>;
  const combined = [...businessEntries.map((entry) => ({ ...entry.business, type: "business", entityId: entry.business.id, _distance: entry.distance })), ...savedItems];
  const visible = filter === "all" ? combined : combined.filter((item) => item.type === filter);
  return <section className="v7-page-enter mx-auto max-w-[1040px]">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Saved</p><h1 className="mt-2 text-[34px] font-semibold tracking-[-.05em] sm:text-[44px]">The things worth keeping.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Businesses, products, services, events and useful places stay together here.</p></div>{combined.length ? <Button variant="outline" onClick={onExplore}>Find more</Button> : null}</div>

    <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setFilter("all")} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", filter === "all" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface)]")}>All{combined.length ? ` ${combined.length}` : ""}</button>{sections.map((section) => { const Icon = section.icon; return <button key={section.key} type="button" onClick={() => setFilter(section.key)} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold", filter === section.key ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface)]")}><Icon className="h-4 w-4" />{section.label}{section.count ? ` ${section.count}` : ""}</button>; })}</div>

    {visible.length ? <div className="mt-7 grid gap-x-8 lg:grid-cols-2">{visible.map((item) => { const business = item.type === "business"; return <SavedRow key={`${item.type}-${item.entityId || item.id}`} item={item} business={business} onOpen={() => business ? onOpenBusiness(item) : onOpenSavedItem(item)} onRemove={() => business ? onRemoveBusiness(item.id) : onRemoveItem(item)} />; })}</div> : <div className="mt-8 rounded-[24px] bg-[var(--surface-2)]"><EmptyState icon={Heart} title={filter === "all" ? "Save the city you want to come back to" : `Nothing saved in ${typeMeta[filter]?.label.toLowerCase() || "this category"}`} description={filter === "all" ? "Tap the heart on restaurants, shops, services, events and products and Spotly will keep them here." : "Browse Spotly and save something in this category when you find it."} action={<Button onClick={onExplore}>Find something nearby</Button>} /></div>}
  </section>;
}
