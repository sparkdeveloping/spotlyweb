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
  Trash2
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SearchField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";

const typeMeta = {
  business: { label: "Businesses", icon: Store },
  product: { label: "Products", icon: ShoppingBag },
  service: { label: "Services", icon: Sparkles },
  event: { label: "Events", icon: CalendarDays },
  place: { label: "Places", icon: MapPin }
};

function money(result) {
  const direct = Number(result.price);
  if (Number.isFinite(direct) && direct > 0) return formatCurrency(direct, result.currency || "USD");
  return "";
}

function SearchResult({ result, onOpen, saved, onSave }) {
  const meta = typeMeta[result.type] || typeMeta.business;
  const Icon = meta.icon;
  return <Card className="group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-elevated">
    <button type="button" onClick={() => onOpen(result)} className="flex w-full gap-4 p-4 text-left sm:p-5">
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[var(--surface-2)] text-[var(--accent)]">
        {result.image ? <Image src={result.image} alt="" fill  className="object-cover" sizes="64px" /> : <Icon className="h-6 w-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold">{result.title || result.name}</span><Badge tone="neutral">{meta.label.slice(0, -1)}</Badge></span>
        {result.subtitle ? <span className="mt-1 block truncate text-xs text-[var(--text-3)]">{result.subtitle}</span> : null}
        {result.description ? <span className="mt-2 line-clamp-2 block text-sm leading-6 text-[var(--text-2)]">{result.description}</span> : null}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-3)]">
          {money(result) ? <strong className="text-[var(--text)]">{money(result)}</strong> : null}
          {result.city || result.area ? <span>{[result.area, result.city].filter(Boolean).join(" · ")}</span> : null}
          {result.startsAt ? <span>{new Date(result.startsAt).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" })}</span> : null}
        </span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)] transition group-hover:translate-x-0.5" />
    </button>
    {result.type !== "place" ? <div className="flex justify-end border-t border-[var(--border-subtle)] px-4 py-2"><button type="button" onClick={() => onSave(result)} className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold", saved ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}><Heart className={cn("h-4 w-4", saved && "fill-current")} />{saved ? "Saved" : "Save"}</button></div> : null}
  </Card>;
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
  return <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-[var(--accent)]">Search{service ? ` · ${serviceLabel}` : ""}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Find anything on Spotly</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Businesses, products, services, events and places in {location.city} share one search.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onLocation}><MapPin className="h-4 w-4" />{location.area || location.city}</Button>{service ? <Button variant="ghost" onClick={onClearService}>{serviceLabel} ×</Button> : null}</div>
    </div>

    <div className="mt-6"><SearchField value={query} onChange={onQuery} label="Search Spotly" placeholder="Try chicken, massage, airport, padel, groceries…" inputProps={{ autoFocus: true, autoComplete: "off" }} /></div>

    <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
      {filters.map((value) => {
        const meta = value === "all" ? { label: "All", icon: Search } : typeMeta[value];
        const Icon = meta.icon;
        const count = value === "all" ? results.length : counts[value] || 0;
        return <button key={value} type="button" onClick={() => onFilter(value)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold", filter === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface)]")}><Icon className="h-4 w-4" />{meta.label}{query && count ? ` ${count}` : ""}</button>;
      })}
    </div>

    {!query.trim() ? <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recent searches</h2>{recentSearches.length ? <button type="button" onClick={onClearRecent} className="text-xs font-semibold text-[var(--accent)]">Clear</button> : null}</div>{recentSearches.length ? <div className="mt-3 divide-y divide-[var(--divider)] rounded-[18px] border border-[var(--border-subtle)] px-4">{recentSearches.map((item) => <button type="button" key={item} onClick={() => onRecent(item)} className="flex w-full items-center gap-3 py-3 text-left"><History className="h-4 w-4 text-[var(--text-3)]" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{item}</span><ArrowRight className="h-4 w-4 text-[var(--text-3)]" /></button>)}</div> : <div className="mt-3 rounded-[18px] bg-[var(--surface-2)] p-5 text-sm text-[var(--text-2)]">Your recent searches will stay on this device for quicker access.</div>}</div>
      <Card className="p-5"><Sparkles className="h-5 w-5 text-[var(--accent)]" /><h2 className="mt-4 font-semibold">Search by intent</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">Try a product, place, service, event, or a broad need such as “massage Saturday”.</p><Button className="mt-5 w-full" variant="outline" onClick={onExplore}>Explore nearby</Button></Card>
    </div> : loading ? <div className="flex items-center justify-center py-20"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" /></div> : error ? <EmptyState className="mt-8" icon={Search} title="Search is temporarily unavailable" description={error} action={<Button variant="outline" onClick={() => onQuery(query)}>Try again</Button>} /> : visible.length ? <div className="mt-7"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Best matches</h2><p className="mt-1 text-xs text-[var(--text-3)]">Ranked across Spotly, not just business names.</p></div><span className="text-xs text-[var(--text-3)]">{visible.length} result{visible.length === 1 ? "" : "s"}</span></div><div className="grid gap-3 lg:grid-cols-2">{visible.map((result) => <SearchResult key={`${result.type}-${result.entityId || result.id}`} result={result} onOpen={onOpenResult} saved={isSaved(result)} onSave={onSaveResult} />)}</div></div> : <EmptyState className="mt-8" icon={Search} title={`No results for “${query}”`} description="Try fewer words, another spelling, or broaden your location." action={<Button onClick={() => onQuery("")}>Clear search</Button>} />}
  </section>;
}

function savedIcon(type) {
  return type === "event" ? Ticket : type === "service" ? Sparkles : type === "product" ? ShoppingBag : type === "place" ? MapPin : Store;
}

export function CustomerSavedView({ user, businessEntries = [], savedItems = [], onOpenBusiness, onOpenSavedItem, onRemoveBusiness, onRemoveItem, onExplore, loginHref }) {
  const [filter, setFilter] = useState("all");
  const sections = [
    { key: "business", label: "Businesses", count: businessEntries.length },
    { key: "product", label: "Products", count: savedItems.filter((item) => item.type === "product").length },
    { key: "service", label: "Services", count: savedItems.filter((item) => item.type === "service").length },
    { key: "event", label: "Events", count: savedItems.filter((item) => item.type === "event").length },
    { key: "place", label: "Places", count: savedItems.filter((item) => item.type === "place").length }
  ];
  if (!user || user.isAnonymous) return <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7"><div><p className="text-sm font-semibold text-[var(--accent)]">Saved</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Keep the things you want to return to</h1></div><EmptyState className="mt-6" icon={Heart} title="Sign in to use Saved" description="Save businesses, products, services, events and places across Spotly." action={<Button asChild><Link href={loginHref}>Sign in</Link></Button>} /></section>;
  const combined = [
    ...businessEntries.map((entry) => ({ ...entry.business, type: "business", entityId: entry.business.id, _distance: entry.distance })),
    ...savedItems
  ];
  const visible = filter === "all" ? combined : combined.filter((item) => item.type === filter);
  return <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Saved</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Your Spotly shortlist</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Businesses, things to buy, services, events and useful places stay together here.</p></div><Button variant="outline" onClick={onExplore}>Explore more</Button></div>
    <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setFilter("all")} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", filter === "all" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface)]")}>All {combined.length || ""}</button>{sections.map((section) => <button key={section.key} type="button" onClick={() => setFilter(section.key)} className={cn("rounded-full border px-3 py-2 text-sm font-semibold", filter === section.key ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface)]")}>{section.label}{section.count ? ` ${section.count}` : ""}</button>)}</div>
    {visible.length ? <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => { const Icon = savedIcon(item.type); const business = item.type === "business"; return <Card key={`${item.type}-${item.entityId || item.id}`} className="overflow-hidden p-0"><button type="button" onClick={() => business ? onOpenBusiness(item) : onOpenSavedItem(item)} className="flex w-full gap-3 p-4 text-left"><span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">{item.image || item.coverImage || item.logoUrl ? <Image src={item.image || item.coverImage || item.logoUrl} alt="" fill  className="object-cover" sizes="56px" /> : <Icon className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{item.title || item.name || "Saved item"}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--text-3)]">{item.subtitle || item.description || [item.area, item.city].filter(Boolean).join(" · ") || typeMeta[item.type]?.label}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)]" /></button><div className="flex justify-end border-t border-[var(--border-subtle)] px-3 py-2"><button type="button" onClick={() => business ? onRemoveBusiness(item.id) : onRemoveItem(item)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-hover)]"><Trash2 className="h-4 w-4" />Remove</button></div></Card>; })}</div> : <EmptyState className="mt-8" icon={Heart} title={filter === "all" ? "Nothing saved yet" : `No saved ${typeMeta[filter]?.label.toLowerCase() || "items"}`} description="Save something while browsing and it will appear here." action={<Button onClick={onExplore}>Browse Spotly</Button>} />}
  </section>;
}
