"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CarFront,
  ChevronRight,
  Clock3,
  Heart,
  Info,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Ticket,
  TimerReset,
  UtensilsCrossed
} from "lucide-react";
import { marketplaceProfile, serviceMatchesMarketplaceBusiness } from "@/lib/marketplace-taxonomy";
import { cn } from "@/lib/cn";
import { ServiceArtwork, ServiceGlyph } from "@/components/service-artwork";
import { marketplaceMedia } from "@/lib/marketplace-editorial";
import { marketplaceTier } from "@/lib/marketplace-ranking";
import { MarketplaceDesignedCover } from "@/components/marketplace-designed-cover";

export const MARKETPLACE_SERVICES = [
  { key: "ride", label: "Ride", subtitle: "Get anywhere", icon: CarFront, tone: "ride" },
  { key: "eat", label: "Bite", subtitle: "Food around you", icon: UtensilsCrossed, tone: "eat" },
  { key: "shop", label: "Shopper", subtitle: "Find what you need", icon: ShoppingBag, tone: "shop" },
  { key: "book", label: "Book", subtitle: "Services & places", icon: Sparkles, tone: "book" },
  { key: "events", label: "Live", subtitle: "What’s happening", icon: CalendarDays, tone: "events" },
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

function interestMatchesBusiness(interests = [], business = {}) {
  if (!Array.isArray(interests) || !interests.length) return false;
  const profile = marketplaceProfile(business);
  return interests.some((interest) => {
    if (interest === "eat") return profile.service === "eat";
    if (["shop", "groceries"].includes(interest)) return profile.service === "shop";
    if (interest === "wellness") return profile.service === "book" && profile.vertical !== "stay";
    if (interest === "activities") return ["book", "events"].includes(profile.service);
    if (interest === "events") return profile.service === "events";
    return false;
  });
}

function MarketplaceImage({ business, sizes = "(max-width: 768px) 72vw, 292px" }) {
  const media = marketplaceMedia(business);
  const profile = marketplaceProfile(business);
  if (!media.src) return <MarketplaceDesignedCover business={business} compact />;
  return <><Image src={media.src} alt="" fill sizes={sizes} className="object-cover transition duration-300 motion-safe:group-hover:scale-[1.025]" />{media.kind === "editorial" ? <span title="Editorial category image — not supplied by this business" aria-label="Editorial category image" className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-[var(--media-text)] backdrop-blur"><Info className="h-3 w-3" /></span> : null}</>;
}

function MarketplaceRailCard({ item, onOpen }) {
  const { business, distance } = item;
  const profile = marketplaceProfile(business);
  const hasImage = Boolean(marketplaceMedia(business).src);
  const placeSuffix = distance !== null ? ` · ${distance.toFixed(1)} km` : business.area ? ` · ${business.area}` : business.city ? ` · ${business.city}` : "";
  return <button type="button" onClick={() => business.assistStoreId && business.assistAccepting !== false ? window.location.assign(`/shop-for-me?store=${encodeURIComponent(business.assistStoreId)}`) : onOpen(business)} className="group w-[244px] shrink-0 text-left sm:w-[286px]">
    <div className="relative aspect-[1.36/1] overflow-hidden rounded-[16px] bg-[var(--surface-2)]">
      <MarketplaceImage business={business} />
      {hasImage ? <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" /> : null}
      {profile.cardMode === "commerce" && business.isFeatured ? <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text)] shadow-sm backdrop-blur">Featured</span> : null}
    </div>
    <div className="mt-3 flex items-start gap-3">
      <div className="min-w-0 flex-1"><h3 className="truncate text-[15px] font-semibold tracking-[-.02em]">{business.name}</h3><p className="mt-1 truncate text-xs text-[var(--text-3)]">{profile.displayCategory}{placeSuffix}</p><p className="mt-1 text-[11px] font-medium text-[var(--text-3)]">{profile.cardMode === "commerce" ? "Available on Spotly" : business.assistStoreId && business.assistAccepting !== false ? "Shop through Spotly Assist · independent listing" : "Directory listing"}</p></div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)]" />
    </div>
  </button>;
}

function SectionHeader({ title, description, action, onAction }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-[22px] font-semibold tracking-[-.035em] sm:text-2xl">{title}</h2>{description ? <p className="mt-1 text-sm text-[var(--text-3)]">{description}</p> : null}</div>{action ? <button type="button" onClick={onAction} className="shrink-0 rounded-[10px] px-2 py-1.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]">{action}</button> : null}</div>;
}


function ServiceTile({ service, size = "small", onSelect }) {
  const reduce = useReducedMotion();
  return <motion.button type="button" onClick={() => onSelect(service.key)} whileHover={reduce ? undefined : { y: -3 }} whileTap={reduce ? undefined : { scale: .988 }} className={cn("spotly-service-tile spotly-v7-service group relative w-full min-w-0 overflow-hidden rounded-[24px] text-left text-[var(--service-foreground)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-soft)]", `spotly-service-${service.tone}`, size === "hero" ? "min-h-[244px] p-6 sm:min-h-[292px] sm:p-7" : size === "medium" ? "min-h-[142px] p-5 sm:min-h-[154px]" : "min-h-[120px] p-4")}>
    <span className="spotly-path-line" aria-hidden="true" />
    <ServiceArtwork service={service.key} compact={size === "small"} className={cn("absolute opacity-[.94] transition-transform duration-300 motion-safe:group-hover:scale-[1.035]", size === "hero" ? "-right-1 top-1 sm:right-4 sm:top-4" : size === "medium" ? "-right-5 -top-3 scale-[.82]" : "-right-5 -top-4 scale-[.72]")} />
    <span className="relative z-10 flex h-full min-h-[inherit] flex-col justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/95 shadow-md"><Image src={`/api/branding/assets/${({eat:"bite",shop:"shopper",events:"live"}[service.key] || service.key)}_horizontal_on_light.svg`} alt="" width={760} height={250} unoptimized className="h-9 w-9 object-cover object-left" /></span>
      <span className={cn("block", size === "hero" ? "max-w-[55%]" : "max-w-[72%]")}><strong className={cn("block tracking-[-.045em]", size === "hero" ? "text-[31px] sm:text-[38px]" : size === "medium" ? "text-[23px]" : "text-[18px]")}>{service.label}</strong><span className={cn("mt-1 block text-[color-mix(in_srgb,var(--service-foreground)_76%,transparent)]", size === "hero" ? "text-sm" : "text-xs")}>{service.subtitle}</span></span>
    </span>
  </motion.button>;
}

function activityMeta(order = {}) {
  const kind = order.transactionType || order.fulfilment || "order";
  if (kind === "ride") return { icon: CarFront, label: "Ride", title: order.status === "driver_arriving" ? "Driver is on the way" : "Your ride is active" };
  if (kind === "send") return { icon: Package, label: "Send", title: "Your parcel is moving" };
  if (kind === "ticket") return { icon: Ticket, label: "Event", title: "You have an upcoming event" };
  if (["appointment", "booking"].includes(kind)) return { icon: CalendarDays, label: "Booking", title: "You have something coming up" };
  return { icon: ShoppingBag, label: "Order", title: "Your order is in progress" };
}

const activeStatuses = new Set(["submitted", "pending", "confirmed", "accepted", "preparing", "ready", "assigned", "driver_arriving", "arrived", "in_progress", "picked_up", "out_for_delivery", "scheduled", "upcoming"]);
const completedStatuses = new Set(["completed", "delivered", "collected", "fulfilled"]);

function ActiveAccessory({ order, onActivity }) {
  if (!order) return null;
  const meta = activityMeta(order); const Icon = meta.icon;
  return <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} type="button" onClick={onActivity} className="mb-5 flex w-full items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--border-subtle))] bg-[var(--accent-soft)] px-4 py-3 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_42%,var(--border))]">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--accent)]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-[.08em] text-[var(--accent)]">Now · {meta.label}</span><strong className="mt-0.5 block truncate text-sm">{meta.title}</strong></span><span className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">View<ChevronRight className="h-4 w-4" /></span>
  </motion.button>;
}

function RepeatAction({ icon: Icon, title, subtitle, onClick }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 border-b border-[var(--border-subtle)] py-3 text-left last:border-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-2)] text-[var(--text-2)]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{title}</strong><span className="mt-0.5 block truncate text-xs text-[var(--text-3)]">{subtitle}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)]" /></button>;
}

export function MarketplaceHome({
  businessResults,
  orders = [],
  recentBusinessIds = [],
  location,
  profile,
  onboardingComplete = false,
  interests = [],
  ridesEnabled = false,
  sendEnabled = false,
  onSelectService,
  onOpenBusiness,
  onSearch,
  onActivity,
  onSetup
}) {
  const readyNow = businessResults.filter(({ business }) => marketplaceTier(business) >= 3).slice(0, 8);
  const nearby = businessResults.slice(0, 8);
  const food = businessResults.filter(({ business }) => serviceMatchesBusiness("eat", business)).slice(0, 8);
  const bookable = businessResults.filter(({ business }) => serviceMatchesBusiness("book", business)).slice(0, 8);
  const events = businessResults.filter(({ business }) => serviceMatchesBusiness("events", business)).slice(0, 8);
  const recent = recentBusinessIds.map((id) => businessResults.find(({ business }) => business.id === id)).filter(Boolean).slice(0, 6);
  const interestMatches = businessResults.filter(({ business }) => interestMatchesBusiness(interests, business)).slice(0, 8);
  const activeOrder = orders.find((order) => activeStatuses.has(String(order.status || "").toLowerCase()));
  const completed = orders.filter((order) => completedStatuses.has(String(order.status || "").toLowerCase()));
  const latestRepeat = completed.find((order) => order.businessId && businessResults.some(({ business }) => business.id === order.businessId));
  const latestRepeatBusiness = latestRepeat ? businessResults.find(({ business }) => business.id === latestRepeat.businessId)?.business : null;
  const firstName = profile?.displayName?.trim()?.split(/\s+/)[0];
  const trulyNew = !orders.length && !recentBusinessIds.length;
  const heroService = ridesEnabled ? MARKETPLACE_SERVICES.find((item) => item.key === "ride") : MARKETPLACE_SERVICES.find((item) => item.key === "eat");
  const secondary = MARKETPLACE_SERVICES.filter((item) => {
    if (item.key === heroService.key) return false;
    if (item.key === "ride") return ridesEnabled;
    if (item.key === "send") return sendEnabled;
    return true;
  });

  return <div className="pb-6">
    <ActiveAccessory order={activeOrder} onActivity={onActivity} />

    <section className="pb-2 pt-2 sm:pt-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[var(--accent)]">{trulyNew ? "Welcome to Spotly" : firstName ? `Good to see you, ${firstName}` : "Your city, in one place"}</p>
          <h1 className="mt-2 text-[36px] font-semibold leading-[1.02] tracking-[-.055em] sm:text-[48px]">{trulyNew ? "Everything around you, easier." : "What do you need today?"}</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[var(--text-2)]">{trulyNew ? `Eat, shop, book and discover what is live in ${location.city}. Spotly keeps everything together as you go.` : `Pick a service or keep going from where you left off in ${location.city}.`}</p>
        </div>
        {!onboardingComplete ? <button type="button" onClick={onSetup} className="inline-flex w-fit items-center gap-2 rounded-[12px] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[color-mix(in_srgb,var(--accent-soft)_82%,var(--accent)_18%)]"><Sparkles className="h-4 w-4" />Set up my Spotly<ChevronRight className="h-4 w-4" /></button> : null}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
        <ServiceTile service={heroService} size="hero" onSelect={onSelectService} />
        <div className="grid grid-cols-2 gap-3">
          {secondary.map((service, index) => <div key={service.key} className={secondary.length % 2 === 1 && index === secondary.length - 1 ? "col-span-2" : ""}><ServiceTile service={service} size={index < 2 ? "medium" : "small"} onSelect={onSelectService} /></div>)}
        </div>
      </div>

      {(!ridesEnabled || !sendEnabled) ? <div className="mt-3 flex flex-wrap gap-2">{!ridesEnabled ? <button type="button" onClick={() => onSelectService("ride")} className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-hover)]"><CarFront className="h-4 w-4 text-[var(--accent)]" />Ride · coming to {location.city}</button> : null}{!sendEnabled ? <button type="button" onClick={() => onSelectService("send")} className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-hover)]"><Package className="h-4 w-4 text-[var(--accent)]" />Send · coming to {location.city}</button> : null}</div> : null}
    </section>

    {latestRepeatBusiness ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-7"><SectionHeader title="Again" description="Based on something you actually completed before" /><div className="max-w-xl"><RepeatAction icon={TimerReset} title={latestRepeatBusiness.name} subtitle="Open this business again" onClick={() => onOpenBusiness(latestRepeatBusiness)} /></div></section> : null}

    {recent.length ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-7"><SectionHeader title="Recently viewed" description="Pick up where you left off" /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{recent.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></section> : null}

    {interestMatches.length ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-7"><SectionHeader title="Based on your interests" description="Using the interests you chose during Spotly setup" action="Explore" onAction={onSearch} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{interestMatches.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></section> : null}

    {readyNow.length ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-7"><SectionHeader title="Ready on Spotly" description="Services with active merchant commerce or explicitly enabled Assist — not just directory profiles" action="Explore" onAction={onSearch}/><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{readyNow.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness}/>)}</div></section> : null}
    {nearby.length ? <p className="mt-7 max-w-2xl text-xs leading-5 text-[var(--text-3)]">Spotly shows usable services first and independent city listings separately. A category photograph is illustrative, never a claim of merchant participation. <a href="/marketplace/editorial/ATTRIBUTION.md" className="underline underline-offset-2">Editorial photo credits</a>.</p> : null}

    {nearby.length ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-7"><SectionHeader title={location.coordinates ? "Discover near you" : `Explore ${location.city}`} description={location.coordinates ? "Ranked by actual service readiness, then relevance and proximity" : "Verified and usable services first, followed by useful city listings"} action="Explore" onAction={onSearch} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{nearby.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></section> : null}

    {food.length ? <section className="mt-10 border-t border-[var(--border-subtle)] pt-7"><SectionHeader title={trulyNew ? "Start with food" : "Bite nearby"} action="Explore Bite" onAction={() => onSelectService("eat")} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{food.map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></section> : null}

    {(events.length || bookable.length) ? <section className="mt-10 grid gap-9 border-t border-[var(--border-subtle)] pt-7 lg:grid-cols-2">
      {bookable.length ? <div className="min-w-0"><SectionHeader title="Book something" action="Explore" onAction={() => onSelectService("book")} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{bookable.slice(0,4).map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></div> : null}
      {events.length ? <div className="min-w-0"><SectionHeader title="This week" action="Events" onAction={() => onSelectService("events")} /><div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">{events.slice(0,4).map((item) => <MarketplaceRailCard key={item.business.id} item={item} onOpen={onOpenBusiness} />)}</div></div> : null}
    </section> : null}

    {!businessResults.length ? <section className="mt-10 rounded-[24px] bg-[var(--surface-2)] p-6 sm:p-8"><div className="max-w-xl"><MapPin className="h-6 w-6 text-[var(--accent)]" /><h2 className="mt-4 text-2xl font-semibold tracking-[-.04em]">Spotly is still filling out {location.city}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">There is nothing useful to show yet. Try Search, change your city, or check back as verified businesses go live.</p><button type="button" onClick={onSearch} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">Search Spotly<ChevronRight className="h-4 w-4" /></button></div></section> : null}
  </div>;
}

export function ServiceModeHeader({ service, location, ridesEnabled, sendEnabled, onSelectService, onExit, onSearch }) {
  const current = MARKETPLACE_SERVICES.find((item) => item.key === service) || MARKETPLACE_SERVICES[1];
  const enabled = service === "ride" ? ridesEnabled : service === "send" ? sendEnabled : true;
  const taskCopy = {
    ride: ["Where to?", "Search a destination or saved place"],
    eat: ["What are you craving?", "Search restaurants, dishes and food"],
    shop: ["What are you looking for?", "Search stores, products and categories"],
    book: ["What would you like to book?", "Find services, wellness, activities and stays"],
    events: ["What are you doing this week?", "Find events, venues and tickets"],
    send: ["Where should it go?", "Choose pickup and drop-off details"]
  }[service] || ["Search Spotly", "Find nearby businesses"];

  return <div className="border-b border-[var(--border-subtle)] pb-5">
    <div className="flex items-start justify-between gap-4"><div><button type="button" onClick={onExit} className="text-xs font-semibold text-[var(--accent)]">← Home</button><div className="mt-2 flex items-center gap-3"><span className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] text-[var(--service-foreground)]", `spotly-service-${current.tone}`)}><ServiceGlyph service={current.key} /></span><h1 className="text-[30px] font-semibold tracking-[-.05em] sm:text-[38px]">{current.label}</h1></div></div><p className="hidden pt-6 text-xs font-semibold text-[var(--text-3)] sm:block">{location.area || location.city}</p></div>
    <div className="no-scrollbar mt-5 flex gap-5 overflow-x-auto border-b border-[var(--border-subtle)]">{MARKETPLACE_SERVICES.map((item) => <button key={item.key} type="button" onClick={() => onSelectService(item.key)} className={cn("relative shrink-0 pb-3 text-sm font-semibold", item.key === service ? "text-[var(--text)] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text)]")}><span className="inline-flex items-center gap-1.5"><ServiceGlyph service={item.key} className="h-4 w-4" />{item.label}</span></button>)}</div>
    <button type="button" onClick={enabled ? onSearch : undefined} className={cn("mt-4 flex min-h-16 w-full items-center gap-3 rounded-[16px] px-4 text-left transition", enabled ? "bg-[var(--surface-2)] hover:bg-[var(--surface-hover)]" : "cursor-default border border-[var(--border-subtle)] bg-[var(--surface-2)]")}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--accent)]">{enabled ? <Search className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">{enabled ? taskCopy[0] : `${current.label} is not live here yet`}</strong><span className="mt-0.5 block text-xs text-[var(--text-3)]">{enabled ? taskCopy[1] : `We will enable ${current.label} when verified operations and support are ready in ${location.city}.`}</span></span>{enabled ? <ChevronRight className="h-5 w-5 text-[var(--text-3)]" /> : null}</button>
  </div>;
}
