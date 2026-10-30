"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
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
import { serviceIdentity } from "@/lib/service-identity";
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
  return serviceMatchesMarketplaceBusiness(service, business || {});
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


function ServiceTile({ service, onSelect, enabled = true, city }) {
  const reduce = useReducedMotion();
  const identity = serviceIdentity(service.key);
  return <motion.button type="button" onClick={() => onSelect(service.key)} whileHover={reduce ? undefined : { y: -4 }} whileTap={reduce ? undefined : { scale: .985 }} data-service={service.key} className="experience-service-tile group" aria-label={`${identity.name}: ${enabled ? service.subtitle : `Not available in ${city} yet`}`}>
    <span className="experience-service-name" aria-hidden="true">{identity.label}</span>
    <ServiceArtwork service={service.key} compact className="experience-tile-art" priority={service.key === "eat"} />
    <span className="experience-tile-copy"><strong>{identity.detail}</strong><span>{enabled ? service.subtitle : `Not available in ${city} yet`}</span></span>
    <span className="experience-tile-arrow" aria-hidden="true"><ArrowUpRight className="h-4 w-4" /></span>
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

  return <div className="pb-6">
    <ActiveAccessory order={activeOrder} onActivity={onActivity} />

    <section className="experience-home-intro" aria-labelledby="home-title">
      <div className="experience-home-heading">
        <div>
          <p className="experience-eyebrow">{trulyNew ? "Welcome to Spotly" : firstName ? `Good to see you, ${firstName}` : "Your city, in one place"}</p>
          <h1 id="home-title">Your city. <span>A little closer.</span></h1>
          <p>Everyday plans, good finds and what comes next in {location.city}.</p>
        </div>
        {!onboardingComplete ? <button type="button" onClick={onSetup} className="experience-setup"><Sparkles className="h-4 w-4" />Make it yours<ChevronRight className="h-4 w-4" /></button> : null}
      </div>
      <button type="button" onClick={onSearch} className="experience-home-search"><Search className="h-5 w-5" /><span>What are you looking for?</span><span className="experience-search-city"><MapPin className="h-4 w-4" />{location.city}</span><span className="experience-search-go" aria-hidden="true"><ArrowUpRight className="h-5 w-5" /></span></button>
      <div className="experience-atlas-label"><h2>One Spotly. Your kind of day.</h2><span>Explore the services</span></div>
      <div className="experience-service-atlas">
        {["eat", "shop", "ride", "book", "events", "send"].map((key) => <ServiceTile key={key} service={MARKETPLACE_SERVICES.find((item) => item.key === key)} enabled={key === "ride" ? ridesEnabled : key === "send" ? sendEnabled : true} city={location.city} onSelect={onSelectService} />)}
      </div>
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

    {!businessResults.length ? <section className="experience-city-state">
      <span className="experience-city-symbol" aria-hidden="true"><MapPin className="h-7 w-7" /></span>
      <div><p className="experience-eyebrow">Growing around you</p><h2>A closer {location.city}, one place at a time.</h2><p>Published places and services will appear here as they become available. You can explore each service or search the city now.</p></div>
      <button type="button" onClick={onSearch}>Explore {location.city}<ArrowUpRight className="h-4 w-4" /></button>
    </section> : null}
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
