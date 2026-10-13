"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  CalendarDays,
  CarFront,
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed
} from "lucide-react";
import { businessArchetype } from "@/data/business-archetypes";
import { cn } from "@/lib/cn";

export const MARKETPLACE_SERVICES = [
  { key: "ride", label: "Ride", subtitle: "Get anywhere", icon: CarFront, tone: "ride" },
  { key: "eat", label: "Eat", subtitle: "Food around you", icon: UtensilsCrossed, tone: "eat" },
  { key: "shop", label: "Shop", subtitle: "Find what you need", icon: ShoppingBag, tone: "shop" },
  { key: "book", label: "Book", subtitle: "Services & places", icon: Sparkles, tone: "book" },
  { key: "events", label: "Events", subtitle: "What’s happening", icon: CalendarDays, tone: "events" },
  { key: "send", label: "Send", subtitle: "Move a package", icon: Package, tone: "send" }
];

export const MARKETPLACE_SERVICE_KEYS = new Set(MARKETPLACE_SERVICES.map((item) => item.key));

export function serviceMatchesBusiness(service, business) {
  if (!service) return true;
  const archetype = businessArchetype(business || {});
  if (service === "eat") return archetype.id === "restaurant_food";
  if (service === "shop") return archetype.id === "grocery_retail";
  if (service === "book") return ["appointments_services", "accommodation_activities"].includes(archetype.id);
  if (service === "events") return archetype.id === "ticketing_events";
  return true;
}

function MarketplaceImage({ business, sizes = "(max-width: 768px) 70vw, 280px" }) {
  const image = business.coverImage || business.image || business.logoUrl || business.logo;
  if (image) return <Image src={image} alt="" fill unoptimized sizes={sizes} className="object-cover transition duration-300 group-hover:scale-[1.02]" />;
  return <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,var(--accent-soft),var(--surface-2))] text-[var(--accent)]"><Store className="h-9 w-9" /></div>;
}

function MarketplaceRailCard({ item, onOpen }) {
  const { business, distance } = item;
  const archetype = businessArchetype(business);
  return (
    <button type="button" onClick={() => onOpen(business)} className="group w-[238px] shrink-0 text-left sm:w-[270px]">
      <div className="relative aspect-[1.35/1] overflow-hidden rounded-[18px] bg-[var(--surface-2)]">
        <MarketplaceImage business={business} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        {business.isFeatured ? <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text)] shadow-sm">Featured</span> : null}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-[-.02em]">{business.name}</h3>
          <p className="mt-1 truncate text-xs text-[var(--text-3)]">{archetype.shortLabel}{distance !== null ? ` · ${distance.toFixed(1)} km` : business.area ? ` · ${business.area}` : business.city ? ` · ${business.city}` : ""}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-3)]" />
      </div>
    </button>
  );
}

function SectionHeader({ title, action, onAction }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><h2 className="text-[22px] font-semibold tracking-[-.035em] sm:text-2xl">{title}</h2>{action ? <button type="button" onClick={onAction} className="text-sm font-semibold text-[var(--accent)] hover:underline">{action}</button> : null}</div>;
}

function ServiceTile({ service, size = "small", enabled = true, onSelect }) {
  const Icon = service.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(service.key)}
      className={cn(
        "spotly-service-tile group relative overflow-hidden text-left text-white transition duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
        `spotly-service-${service.tone}`,
        size === "hero" ? "min-h-[180px] rounded-[28px] p-6 sm:min-h-[205px] sm:p-7" : size === "medium" ? "min-h-[142px] rounded-[24px] p-5" : "min-h-[112px] rounded-[22px] p-4"
      )}
    >
      <span className="spotly-service-orbit spotly-service-orbit-a" aria-hidden="true" />
      <span className="spotly-service-orbit spotly-service-orbit-b" aria-hidden="true" />
      <span className="relative z-10 flex h-full flex-col justify-between gap-8">
        <span className="flex items-start justify-between gap-4">
          <span className={cn("flex items-center justify-center bg-[rgba(255,255,255,.16)] backdrop-blur-sm", size === "hero" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-[14px]")}><Icon className={size === "hero" ? "h-6 w-6" : "h-5 w-5"} /></span>
          <span className="flex items-center gap-1 text-xs font-semibold text-white/80">{enabled ? "Open" : "Soon"}<ArrowUpRight className="h-4 w-4" /></span>
        </span>
        <span>
          <strong className={cn("block tracking-[-.04em]", size === "hero" ? "text-[30px] sm:text-[34px]" : size === "medium" ? "text-[23px]" : "text-[18px]")}>{service.label}</strong>
          <span className={cn("mt-1 block text-white/76", size === "hero" ? "text-sm" : "text-xs")}>{enabled ? service.subtitle : `${service.label} is being prepared`}</span>
        </span>
      </span>
    </button>
  );
}

function RepeatAction({ icon: Icon, title, subtitle, onClick }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 border-b border-[var(--border-subtle)] py-3 text-left last:border-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--surface-2)] text-[var(--text-2)]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{title}</strong><span className="mt-0.5 block truncate text-xs text-[var(--text-3)]">{subtitle}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)]" /></button>;
}

export function MarketplaceHome({
  businessResults,
  orders = [],
  location,
  ridesEnabled = false,
  sendEnabled = false,
  onSelectService,
  onOpenBusiness,
  onSearch,
  onActivity,
  onLocation
}) {
  const nearby = businessResults.slice(0, 8);
  const food = businessResults.filter(({ business }) => serviceMatchesBusiness("eat", business)).slice(0, 8);
  const bookable = businessResults.filter(({ business }) => serviceMatchesBusiness("book", business)).slice(0, 8);
  const events = businessResults.filter(({ business }) => serviceMatchesBusiness("events", business)).slice(0, 8);
  const latestOrder = orders?.[0];
  const latestOrderBusiness = latestOrder ? businessResults.find(({ business }) => business.id === latestOrder.businessId)?.business : null;

  return (
    <div className="pb-8">
      <section className="rounded-[30px] bg-[var(--surface)] px-4 pb-5 pt-3 sm:px-6 sm:pb-7 sm:pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button type="button" onClick={onLocation} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text)]"><MapPin className="h-4 w-4" />{location.area ? `${location.area}, ${location.city}` : location.city}<ChevronRight className="h-3.5 w-3.5 rotate-90" /></button>
            <h1 className="mt-3 max-w-xl text-[34px] font-semibold leading-[1.02] tracking-[-.052em] sm:text-[42px]">What do you need?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-2)] sm:text-[15px]">Use Spotly to find what is around you, order from local businesses, book plans, and keep moving through your city.</p>
          </div>
          <button type="button" onClick={onSearch} className="hidden h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold shadow-[var(--shadow-card)] sm:inline-flex"><Search className="h-4 w-4" />Search</button>
        </div>

        {ridesEnabled ? <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ServiceTile service={MARKETPLACE_SERVICES[0]} size="hero" enabled onSelect={onSelectService} />
            <div className="grid grid-cols-2 gap-3">
              <ServiceTile service={MARKETPLACE_SERVICES[1]} size="medium" onSelect={onSelectService} />
              <ServiceTile service={MARKETPLACE_SERVICES[2]} size="medium" onSelect={onSelectService} />
              <ServiceTile service={MARKETPLACE_SERVICES[3]} onSelect={onSelectService} />
              <ServiceTile service={MARKETPLACE_SERVICES[4]} onSelect={onSelectService} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ServiceTile service={MARKETPLACE_SERVICES[5]} enabled={sendEnabled} onSelect={onSelectService} />
            <button type="button" onClick={onSearch} className="group min-h-[112px] rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left transition hover:bg-[var(--surface-hover)] sm:col-span-2"><span className="flex h-full items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[var(--surface)] text-[var(--accent)]"><Search className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-base font-semibold tracking-[-.025em]">Search all of Spotly</strong><span className="mt-1 block text-xs leading-5 text-[var(--text-3)]">Find businesses, categories, and places currently available in {location.city}.</span></span><ChevronRight className="h-5 w-5 text-[var(--text-3)]" /></span></button>
          </div>
        </> : <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ServiceTile service={MARKETPLACE_SERVICES[1]} size="hero" onSelect={onSelectService} />
            <div className="grid grid-cols-2 gap-3">
              <ServiceTile service={MARKETPLACE_SERVICES[2]} size="medium" onSelect={onSelectService} />
              <ServiceTile service={MARKETPLACE_SERVICES[3]} size="medium" onSelect={onSelectService} />
              <ServiceTile service={MARKETPLACE_SERVICES[4]} onSelect={onSelectService} />
              <ServiceTile service={MARKETPLACE_SERVICES[0]} enabled={false} onSelect={onSelectService} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ServiceTile service={MARKETPLACE_SERVICES[5]} enabled={sendEnabled} onSelect={onSelectService} />
            <button type="button" onClick={onSearch} className="group min-h-[112px] rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left transition hover:bg-[var(--surface-hover)] sm:col-span-2"><span className="flex h-full items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[var(--surface)] text-[var(--accent)]"><Search className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-base font-semibold tracking-[-.025em]">Search all of Spotly</strong><span className="mt-1 block text-xs leading-5 text-[var(--text-3)]">Find businesses, categories, and places currently available in {location.city}.</span></span><ChevronRight className="h-5 w-5 text-[var(--text-3)]" /></span></button>
          </div>
        </>}
      </section>

      {(latestOrder || nearby.length) ? <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[24px] bg-[var(--surface)] p-5 sm:p-6">
          <SectionHeader title="Again" action={orders.length ? "Activity" : undefined} onAction={onActivity} />
          {latestOrderBusiness ? <RepeatAction icon={ShoppingBag} title={`Order again from ${latestOrderBusiness.name}`} subtitle={latestOrder.fulfilment === "delivery" ? "Previous delivery" : "Previous pickup order"} onClick={() => onOpenBusiness(latestOrderBusiness)} /> : null}
          <RepeatAction icon={Search} title="Search nearby" subtitle={`Explore verified businesses in ${location.city}`} onClick={onSearch} />
          {ridesEnabled ? <RepeatAction icon={CarFront} title="Ride somewhere" subtitle="Start with a destination" onClick={() => onSelectService("ride")} /> : null}
        </div>

        <div className="min-w-0 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6">
          <SectionHeader title="Near you" action="See all" onAction={() => onSelectService("shop")} />
          {nearby.length ? <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{nearby.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div> : <p className="text-sm leading-6 text-[var(--text-3)]">Businesses will appear here as verified locations in {location.city} go live.</p>}
        </div>
      </section> : null}

      {food.length ? <section className="mt-8 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6"><SectionHeader title="Eat nearby" action="Explore Eat" onAction={() => onSelectService("eat")} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{food.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></section> : null}

      {(events.length || bookable.length) ? <section className="mt-8 grid gap-5 lg:grid-cols-2">
        {bookable.length ? <div className="min-w-0 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6"><SectionHeader title="Book something" action="Explore" onAction={() => onSelectService("book")} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{bookable.slice(0,4).map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></div> : null}
        {events.length ? <div className="min-w-0 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6"><SectionHeader title="What’s happening" action="Events" onAction={() => onSelectService("events")} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{events.slice(0,4).map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></div> : null}
      </section> : null}
    </div>
  );
}

export function ServiceModeHeader({ service, location, ridesEnabled, sendEnabled, onSelectService, onExit, onSearch }) {
  const current = MARKETPLACE_SERVICES.find((item) => item.key === service) || MARKETPLACE_SERVICES[1];
  const enabled = service === "ride" ? ridesEnabled : service === "send" ? sendEnabled : true;
  const taskCopy = {
    ride: ["Where to?", "Search a destination or saved place"],
    eat: ["What are you craving?", "Search restaurants and food businesses"],
    shop: ["What are you looking for?", "Search stores and products by business"],
    book: ["What would you like to book?", "Find services, wellness, activities and stays"],
    events: ["What’s happening?", "Find events and ticketing businesses"],
    send: ["Where should it go?", "Spotly Send is being prepared"]
  }[service] || ["Search Spotly", "Find nearby businesses"];

  return (
    <div className="rounded-[26px] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onExit} className="text-xs font-semibold text-[var(--accent)]">← Home</button>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-.05em] sm:text-[36px]">{current.label}</h1>
        </div>
        <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-[var(--text-3)]">{location.area || location.city}</p><p className="mt-1 text-xs text-[var(--text-3)]">{enabled ? "Available marketplace" : "Being prepared"}</p></div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-5 overflow-x-auto border-b border-[var(--border-subtle)]">
        {MARKETPLACE_SERVICES.map((item) => <button key={item.key} type="button" onClick={() => onSelectService(item.key)} className={cn("relative shrink-0 pb-3 text-sm font-semibold", item.key === service ? "text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}>{item.label}</button>)}
      </div>

      <button type="button" onClick={enabled ? onSearch : undefined} className={cn("mt-4 flex min-h-16 w-full items-center gap-3 rounded-[18px] px-4 text-left", enabled ? "bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]" : "cursor-default border border-[var(--border)] bg-[var(--surface-2)]") }>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--surface)] text-[var(--accent)]">{service === "ride" ? <CarFront className="h-5 w-5" /> : service === "send" ? <Package className="h-5 w-5" /> : <Search className="h-5 w-5" />}</span>
        <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">{enabled ? taskCopy[0] : `${current.label} is coming next`}</strong><span className="mt-0.5 block text-xs text-[var(--text-3)]">{enabled ? taskCopy[1] : `Spotly ${current.label} is opening area by area. Requests will only become available when verified operations and support are ready in your location.`}</span></span>
        {enabled ? <ChevronRight className="h-5 w-5 text-[var(--text-3)]" /> : <Clock3 className="h-5 w-5 text-[var(--text-3)]" />}
      </button>
    </div>
  );
}
