"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Grid2X2,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  Ticket,
  Truck,
  UsersRound,
  UtensilsCrossed,
  WalletCards
} from "lucide-react";
import { Button } from "@/components/ui";
import { spotlyLoginUrl, spotlyPortalUrl } from "@/lib/spotly-domains";

const TYPES = [
  {
    id: "shop",
    label: "Sell products",
    eyebrow: "Retail & groceries",
    description: "Products, stock, pickup, delivery and promotions — without building an online store from scratch.",
    icon: ShoppingBasket,
    statLabel: "Orders today",
    statValue: "17",
    money: "$284.40",
    queue: ["3 new orders", "2 substitutions", "1 pickup ready"],
    offering: "Products",
    activity: "Orders"
  },
  {
    id: "food",
    label: "Serve food",
    eyebrow: "Restaurants & cafés",
    description: "Publish your menu, manage availability, prepare orders and coordinate pickup or delivery.",
    icon: UtensilsCrossed,
    statLabel: "Orders today",
    statValue: "24",
    money: "$391.20",
    queue: ["4 new orders", "5 preparing", "3 ready"],
    offering: "Menu",
    activity: "Orders"
  },
  {
    id: "services",
    label: "Take bookings",
    eyebrow: "Beauty & services",
    description: "Let clients discover services, choose a time and keep your team clear on what is happening next.",
    icon: CalendarDays,
    statLabel: "Bookings today",
    statValue: "9",
    money: "$168.00",
    queue: ["2 upcoming", "1 reschedule", "6 confirmed"],
    offering: "Services",
    activity: "Calendar"
  },
  {
    id: "events",
    label: "Sell experiences",
    eyebrow: "Events & activities",
    description: "Create events, sell tickets, follow attendance and check guests in from the same workspace.",
    icon: Ticket,
    statLabel: "Tickets sold",
    statValue: "86",
    money: "$1,032.00",
    queue: ["1 event this week", "18 check-ins", "4 ticket types"],
    offering: "Events",
    activity: "Attendees"
  },
  {
    id: "stay",
    label: "Take reservations",
    eyebrow: "Stays & activities",
    description: "Keep listings, availability, reservations and guest operations together without generic retail workflows.",
    icon: MapPin,
    statLabel: "Reservations",
    statValue: "7",
    money: "$742.00",
    queue: ["2 arrivals today", "1 guest message", "4 upcoming"],
    offering: "Listings",
    activity: "Reservations"
  }
];

const VALUE = [
  { icon: Store, title: "Be easier to find", text: "Keep your Spotly profile, locations, hours and customer-facing information accurate." },
  { icon: ClipboardCheck, title: "Turn discovery into action", text: "Orders, bookings, tickets, reservations or enquiries appear only when they fit your business." },
  { icon: WalletCards, title: "Understand your money", text: "See customer payments, refunds, fees, settlement status and what Spotly owes you." },
  { icon: UsersRound, title: "Run it with your team", text: "Give owners, managers and frontline staff the access they actually need." }
];

const STEPS = [
  { number: "01", title: "Find your business", text: "Search first. If Spotly already knows the business, start from that listing instead of entering everything again.", icon: Search },
  { number: "02", title: "Confirm what is yours", text: "Check the business, locations and your relationship. We only ask for extra organization detail when your setup actually needs it.", icon: ShieldCheck },
  { number: "03", title: "Prepare while we verify", text: "Add products, services, a menu, hours, payout details and your team while Spotly reviews ownership.", icon: Sparkles }
];

function ProductPreview({ type }) {
  const Icon = type.icon;
  return <div className="relative mx-auto w-full max-w-2xl">
    <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-business/10 blur-3xl" aria-hidden="true" />
    <div className="absolute -right-8 bottom-8 h-48 w-48 rounded-full bg-business-soft blur-3xl" aria-hidden="true" />
    <div className="relative overflow-hidden rounded-2xl border border-business/15 bg-[var(--surface)] shadow-elevated">
      <div className="flex items-center justify-between border-b bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business text-[var(--on-accent)]"><Icon className="h-5 w-5" /></span>
          <div><p className="text-sm font-bold">Sample business</p><p className="text-xs text-secondary">{type.eyebrow}</p></div>
        </div>
        <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-success">Open</span>
      </div>
      <div className="grid md:grid-cols-[165px_1fr]">
        <div className="hidden border-r bg-[var(--surface-2)] p-3 md:block">
          {[{ icon: LayoutDashboard, label: "Today" }, { icon: ClipboardCheck, label: type.activity }, { icon: Grid2X2, label: type.offering }, { icon: BarChart3, label: "Insights" }, { icon: WalletCards, label: "Money" }].map((item, index) => <div key={item.label} className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${index === 0 ? "bg-business-soft text-business" : "text-secondary"}`}><item.icon className="h-4 w-4" />{item.label}</div>)}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-business">Today</p><h3 className="mt-1 text-xl font-bold">What needs your attention</h3></div><span className="rounded-full bg-business-soft px-3 py-1 text-xs font-bold text-business">Live workspace</span></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-[var(--surface)] p-4"><p className="text-xs text-secondary">{type.statLabel}</p><p className="mt-2 text-2xl font-bold tracking-tight">{type.statValue}</p></div>
            <div className="rounded-2xl border bg-[var(--surface)] p-4"><p className="text-xs text-secondary">Sales / value</p><p className="mt-2 text-2xl font-bold tracking-tight">{type.money}</p></div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border">
            {type.queue.map((item, index) => <div key={item} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[var(--warning)]" : index === 1 ? "bg-business" : "bg-[var(--success)]"}`} /><span className="min-w-0 flex-1 text-sm font-semibold">{item}</span><ArrowRight className="h-4 w-4 text-tertiary" /></div>)}
          </div>
        </div>
      </div>
    </div>
    <div className="relative -mt-5 ml-auto mr-5 flex w-[78%] items-center gap-3 rounded-2xl border bg-[var(--surface)] p-4 shadow-card sm:w-[62%]">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success-soft)] text-success"><CheckCircle2 className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-sm font-bold">Next payout is on track</p><p className="mt-0.5 text-xs text-secondary">You see what happened and what comes next.</p></div>
    </div>
  </div>;
}

export function BusinessMarketingPage({ loginHref }) {
  const [activeType, setActiveType] = useState("shop");
  const type = TYPES.find((item) => item.id === activeType) || TYPES[0];
  const signInHref = loginHref || spotlyLoginUrl("business", { next: "/", mode: "signin" });
  const claimHref = spotlyPortalUrl("business", "/get-started");
  const addHref = spotlyPortalUrl("business", "/get-started?new=1");
  return <main data-workspace="business" className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Spotly Business home"><Image src="/brand/spotly-business.svg" alt="" width={40} height={40} className="h-10 w-10" /><span className="font-bold tracking-tight">Spotly Business</span></Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Business marketing"><a href="#business-types" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">For your business</a><a href="#how-it-works" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">How it works</a><a href="#features" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">What you get</a></nav>
        <div className="ml-auto flex items-center gap-2 md:ml-3"><Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href={signInHref}>Sign in</Link></Button><Button asChild><Link href={claimHref}>Find my business<ArrowRight className="h-4 w-4" /></Link></Button></div>
      </div>
    </header>

    <section className="overflow-hidden border-b">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:py-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-business/20 bg-business-soft px-3 py-1.5 text-xs font-bold text-business"><Sparkles className="h-4 w-4" />Built for businesses on Spotly</div>
          <h1 className="mt-6 text-4xl font-bold tracking-[-.045em] sm:text-5xl lg:text-6xl">Run your business where Zimbabwe discovers it.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-secondary sm:text-lg">Sell products. Take food orders. Accept bookings. Sell tickets. Manage locations, delivery, money and your team — in a workspace that changes to fit your business.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href={claimHref}><Search className="h-5 w-5" />Find or claim my business</Link></Button><Button asChild size="lg" variant="outline"><Link href={addHref}>Add a new business</Link></Button></div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-secondary"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Search before starting from zero</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Prepare while verification runs</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Use the same Spotly account</span></div>
          <p className="mt-7 text-sm text-secondary">Already use Spotly Business? <Link href={signInHref} className="font-bold text-business hover:underline">Sign in to your workspace</Link></p>
        </div>
        <ProductPreview type={type} />
      </div>
    </section>

    <section id="business-types" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
      <div className="max-w-2xl"><p className="text-sm font-bold text-business">Built around the job</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">Your business should not have to learn a generic dashboard.</h2><p className="mt-4 text-base leading-7 text-secondary">Choose what sounds most like you. Spotly changes the language, workflows and daily priorities instead of forcing every business into the same retail template.</p></div>
      <div className="mt-8 grid gap-3 md:grid-cols-5">{TYPES.map((item) => { const Icon = item.icon; const active = item.id === activeType; return <button key={item.id} type="button" onClick={() => setActiveType(item.id)} className={`rounded-2xl border p-5 text-left transition ${active ? "border-business bg-business-soft shadow-sm" : "bg-[var(--surface)] hover:-translate-y-0.5 hover:border-business/30 hover:shadow-card"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-business text-[var(--on-accent)]" : "bg-grouped text-secondary"}`}><Icon className="h-5 w-5" /></span><p className="mt-4 font-bold">{item.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{item.eyebrow}</p></button>; })}</div>
      <div className="mt-5 grid gap-6 rounded-2xl border bg-[var(--surface)] p-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:p-8"><div><span className="text-xs font-bold uppercase tracking-[.14em] text-business">{type.eyebrow}</span><h3 className="mt-2 text-2xl font-bold">{type.label} without the generic software feeling.</h3><p className="mt-3 leading-7 text-secondary">{type.description}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-grouped px-3 py-1.5 text-xs font-semibold">{type.activity}</span><span className="rounded-full bg-grouped px-3 py-1.5 text-xs font-semibold">{type.offering}</span><span className="rounded-full bg-grouped px-3 py-1.5 text-xs font-semibold">Money</span><span className="rounded-full bg-grouped px-3 py-1.5 text-xs font-semibold">Team</span></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ icon: Clock3, label: "What needs attention" }, { icon: PackageCheck, label: `Your ${type.offering.toLowerCase()}` }, { icon: CreditCard, label: "Customer payments" }, { icon: BarChart3, label: "Useful insights" }].map((item) => <div key={item.label} className="rounded-2xl bg-[var(--surface-2)] p-4"><item.icon className="h-5 w-5 text-business" /><p className="mt-4 text-sm font-bold leading-5">{item.label}</p></div>)}</div></div>
    </section>

    <section id="how-it-works" className="border-y bg-[var(--surface-2)]">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl"><p className="text-sm font-bold text-business">From listed to yours</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">Most businesses should not start from an empty form.</h2><p className="mt-4 leading-7 text-secondary">Spotly searches first, keeps what is already useful, then asks you to verify only what needs your authority.</p></div>
        <div className="mt-9 grid gap-4 lg:grid-cols-3">{STEPS.map((item) => <div key={item.number} className="rounded-2xl border bg-[var(--surface)] p-6"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-business-soft text-business"><item.icon className="h-5 w-5" /></span><span className="text-sm font-bold text-tertiary">{item.number}</span></div><h3 className="mt-5 text-xl font-bold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-secondary">{item.text}</p></div>)}</div>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-business/20 bg-business-soft p-6 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-business"><ShieldCheck className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="font-bold">Verification protects the business. It should not freeze your progress.</p><p className="mt-1 text-sm leading-6 text-secondary">Prepare your customer experience while Spotly confirms ownership or authority. Commerce only activates when the business is ready and approved.</p></div><Button asChild variant="outline"><Link href={claimHref}>Start with search<ArrowRight className="h-4 w-4" /></Link></Button></div>
      </div>
    </section>

    <section id="features" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
      <div className="max-w-2xl"><p className="text-sm font-bold text-business">One operating home</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">See what is happening. Know what to do next.</h2><p className="mt-4 leading-7 text-secondary">Spotly Business is organized around merchant decisions, not payment-provider jargon or database structure.</p></div>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{VALUE.map((item) => <div key={item.title} className="rounded-2xl border bg-[var(--surface)] p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-business-soft text-business"><item.icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{item.text}</p></div>)}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border bg-[var(--surface)] p-6 lg:col-span-2"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business-soft text-business"><Truck className="h-5 w-5" /></span><div><p className="font-bold">Locations, pickup and delivery</p><p className="text-sm text-secondary">One location or many, without losing the exact place an order or booking belongs to.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{["Harare CBD · Open", "Avondale · Open", "Borrowdale · Paused"].map((item, index) => <div key={item} className="rounded-2xl bg-[var(--surface-2)] p-4"><MapPin className={`h-5 w-5 ${index === 2 ? "text-tertiary" : "text-business"}`} /><p className="mt-3 text-sm font-bold">{item}</p></div>)}</div></div><div className="rounded-2xl bg-[var(--inverse-surface)] p-6 text-[var(--inverse-text)]"><BadgeDollarSign className="h-7 w-7 text-business" /><h3 className="mt-5 text-xl font-bold">Money without provider jargon</h3><p className="mt-3 text-sm leading-6 text-[var(--inverse-text-muted)]">Paid? Refunded? Fees? Next payout? Spotly Business should answer those questions directly.</p><div className="mt-6 rounded-2xl bg-[var(--surface)]/10 p-4"><p className="text-xs text-[var(--inverse-text-muted)]">Next payout</p><p className="mt-1 text-2xl font-bold">$428.60</p><p className="mt-1 text-xs text-business">On track</p></div></div></div>
    </section>

    <section className="border-t bg-[var(--inverse-surface)] text-[var(--inverse-text)]">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16"><div className="max-w-2xl"><p className="text-sm font-bold text-business">Your business may already be on Spotly.</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">Find it before you build it again.</h2><p className="mt-4 leading-7 text-[var(--inverse-text-muted)]">Claim an existing listing, add one that is missing, or sign in if your team already invited you.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-business text-[var(--on-accent)] hover:bg-business-strong"><Link href={claimHref}>Find my business<Search className="h-5 w-5" /></Link></Button><Button asChild size="lg" variant="outline" className="border-[var(--inverse-text-muted)]/30 bg-[var(--surface)]/5 text-[var(--inverse-text)] hover:bg-[var(--surface)]/10"><Link href={signInHref}>Sign in</Link></Button></div></div>
    </section>

    <footer className="border-t bg-[var(--surface)]"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-8 text-sm text-secondary sm:px-6 md:flex-row md:items-center"><div className="flex items-center gap-2"><Image src="/brand/spotly-business.svg" alt="" width={28} height={28} /><span className="font-semibold text-[var(--text)]">Spotly Business</span><span>· Run what customers discover.</span></div><div className="flex flex-wrap gap-x-5 gap-y-2 md:ml-auto"><Link href={spotlyPortalUrl("customer")} className="hover:text-[var(--text)]">Spotly</Link><Link href={spotlyPortalUrl("customer", "/help")} className="hover:text-[var(--text)]">Help</Link><Link href={spotlyPortalUrl("customer", "/privacy")} className="hover:text-[var(--text)]">Privacy</Link><Link href={spotlyPortalUrl("customer", "/terms")} className="hover:text-[var(--text)]">Terms</Link></div></div></footer>
  </main>;
}
