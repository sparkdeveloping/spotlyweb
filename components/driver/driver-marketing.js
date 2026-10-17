"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bike,
  CarFront,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  HeartHandshake,
  MapPin,
  Navigation,
  Package,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Truck,
  WalletCards,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";
import { DriverEligibilityPlanner } from "@/components/driver/eligibility-planner";
import { spotlyLoginUrl, spotlyPortalUrl } from "@/lib/spotly-domains";

const WORK_TYPES = [
  {
    id: "prepared",
    label: "Deliver prepared orders",
    eyebrow: "Restaurants & retail",
    description: "Pick up orders that a restaurant, shop or grocery team has already prepared, then deliver them securely to the customer.",
    icon: PackageCheck,
    badge: "Prepared delivery",
    pay: "$4.80",
    pickup: "2.1 km to pickup",
    work: "4.8 km delivery",
    time: "~23 min total",
    route: "Avondale → Belvedere",
    details: ["Order prepared by business", "2 bags · 1 drink", "Pickup + delivery verification"],
  },
  {
    id: "shop",
    label: "Shop & deliver",
    eyebrow: "Groceries",
    description: "Shop a customer-funded basket, handle approved substitutions, complete authorized checkout and deliver the order.",
    icon: ShoppingBasket,
    badge: "Shop & Deliver",
    pay: "$7.40",
    pickup: "1.4 km to store",
    work: "18 items · 5.7 km delivery",
    time: "~48 min total",
    route: "Borrowdale → Highlands",
    details: ["18-item shopping list", "Customer substitution rules", "Spotly-authorized checkout"],
  },
  {
    id: "ride",
    label: "Drive rides",
    eyebrow: "Passenger trips",
    description: "Accept passenger trips when your vehicle and Ride capability are approved for the service available in your city.",
    icon: CarFront,
    badge: "Ride",
    pay: "$6.10",
    pickup: "1.8 km to rider",
    work: "8.6 km trip",
    time: "~26 min total",
    route: "CBD → Mount Pleasant",
    details: ["Pickup area before acceptance", "Trip distance + expected time", "PIN-verified trip start"],
  },
  {
    id: "send",
    label: "Move Send parcels",
    eyebrow: "Courier work",
    description: "Collect declared parcels and deliver them with pickup and recipient verification, proof and return handling where required.",
    icon: Package,
    badge: "Send",
    pay: "$5.25",
    pickup: "2.6 km to sender",
    work: "6.2 km delivery",
    time: "~31 min total",
    route: "Eastlea → Greendale",
    details: ["Parcel size before acceptance", "Pickup + recipient PIN", "Proof when the job requires it"],
  },
];

const STEPS = [
  { number: "01", icon: Gauge, title: "Check what fits you", text: "Choose your city, vehicle and the kinds of work you want. Spotly shows the likely requirements before you commit." },
  { number: "02", icon: FileCheck2, title: "Apply with the right evidence", text: "Complete only the identity, vehicle, document and short training requirements that apply to those work types." },
  { number: "03", icon: ShieldCheck, title: "Know what Spotly is reviewing", text: "Your Activation Centre separates what you still need to do from what Driver Operations is checking." },
  { number: "04", icon: Navigation, title: "Go online when you are ready", text: "Choose an approved vehicle and active work types, keep GPS healthy, then decide whether each offer is worth accepting." },
];

const VALUE = [
  { icon: WalletCards, title: "Know the job before accepting", text: "Work type, expected Driver pay, pickup distance, job distance, workload and time are shown before you decide." },
  { icon: Navigation, title: "One clear next action", text: "Once you accept, the active job tells you what to do now, what comes next and how to handle common problems." },
  { icon: ShieldCheck, title: "Safety stays close", text: "Urgent Spotly support, current job context, location sharing and structured safety reporting stay available while you work." },
  { icon: WalletCards, title: "Money you can understand", text: "See today, available balances, cash obligations, payout readiness and job earnings without learning ledger terminology." },
];

function DriverPreview({ type }) {
  const Icon = type.icon;
  return <div className="relative mx-auto w-full max-w-2xl">
    <div className="absolute -left-8 top-10 h-48 w-48 rounded-full bg-driver/10 blur-3xl" aria-hidden="true" />
    <div className="absolute -right-8 bottom-8 h-52 w-52 rounded-full bg-driver-soft blur-3xl" aria-hidden="true" />
    <div className="relative overflow-hidden rounded-2xl border border-driver/15 bg-[var(--surface)] shadow-elevated">
      <div className="flex items-center justify-between border-b bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center gap-3">
          <Image src="/brand/spotly-driver.svg" alt="" width={40} height={40} className="h-10 w-10" />
          <div><p className="text-sm font-bold">Spotly Driver</p><p className="text-xs text-secondary">Sample Driver workspace</p></div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-success"><span className="h-2 w-2 rounded-full bg-success" />Online</span>
      </div>
      <div className="grid md:grid-cols-[150px_1fr]">
        <div className="hidden border-r bg-[var(--surface-2)] p-3 md:block">
          {["Home", "Work", "Active", "Money", "Account"].map((label, index) => <div key={label} className={`mb-1 rounded-xl px-3 py-2.5 text-xs font-semibold ${index === 1 ? "bg-driver-soft text-driver" : "text-secondary"}`}>{label}</div>)}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-driver">Offer now</p><h3 className="mt-1 text-xl font-bold">Decide with the work in front of you</h3></div>
            <span className="rounded-full bg-driver-soft px-3 py-1 text-xs font-bold text-driver">{type.badge}</span>
          </div>
          <div className="mt-5 rounded-2xl border border-driver/20 bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-driver text-[var(--on-accent)]"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-xs text-secondary">Sample offer · illustrative</p><p className="mt-1 text-base font-bold">{type.route}</p></div>
              <div className="text-right"><p className="text-xs text-secondary">Driver pay</p><p className="mt-1 text-2xl font-bold tracking-tight">{type.pay}</p></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[type.pickup, type.work, type.time].map((item) => <div key={item} className="rounded-xl bg-[var(--surface-2)] px-3 py-3 text-xs font-semibold">{item}</div>)}
            </div>
            <div className="mt-4 space-y-2">{type.details.map((item) => <div key={item} className="flex items-center gap-2 text-xs text-secondary"><CheckCircle2 className="h-4 w-4 shrink-0 text-driver" />{item}</div>)}</div>
            <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className="rounded-xl border px-4 py-3 text-sm font-bold text-secondary">Decline</button><button type="button" className="rounded-xl bg-driver px-4 py-3 text-sm font-bold text-[var(--on-accent)]">Accept offer</button></div>
          </div>
        </div>
      </div>
    </div>
    <div className="relative -mt-5 ml-auto mr-5 flex w-[82%] items-center gap-3 rounded-2xl border bg-[var(--surface)] p-4 shadow-card sm:w-[66%]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft)] text-success"><Wifi className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="text-sm font-bold">GPS good · dispatchable</p><p className="mt-0.5 text-xs text-secondary">Driver can see whether Spotly is actually receiving a usable location.</p></div>
    </div>
  </div>;
}

export function DriverMarketingPage({ loginHref }) {
  const [activeType, setActiveType] = useState("prepared");
  const { user, authReady } = useAuth();
  const type = WORK_TYPES.find((item) => item.id === activeType) || WORK_TYPES[0];
  const signInHref = loginHref || spotlyLoginUrl("driver", { next: "/", mode: "signin" });
  const applyHref = authReady && user && !user.isAnonymous
    ? spotlyPortalUrl("driver")
    : spotlyLoginUrl("driver", { next: "/", mode: "signup" });

  return <main data-workspace="driver" className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
        <Link href={spotlyPortalUrl("driver")} className="flex items-center gap-3" aria-label="Spotly Driver home"><Image src="/brand/spotly-driver.svg" alt="" width={40} height={40} className="h-10 w-10" /><span className="font-bold tracking-tight">Spotly Driver</span></Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Driver marketing"><a href="#work" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">Ways to earn</a><a href="#how-it-works" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">How it works</a><a href="#eligibility" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">What you need</a><a href="#driver-value" className="rounded-xl px-3 py-2 text-sm font-semibold text-secondary hover:bg-grouped">What you get</a></nav>
        <div className="ml-auto flex items-center gap-2 md:ml-3"><Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href={signInHref}>Sign in</Link></Button><Button asChild><Link href={applyHref}>Start driving<ArrowRight className="h-4 w-4" /></Link></Button></div>
      </div>
    </header>

    <section className="overflow-hidden border-b">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:py-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-driver/20 bg-driver-soft px-3 py-1.5 text-xs font-bold text-driver"><Sparkles className="h-4 w-4" />Built for earning on Spotly</div>
          <h1 className="mt-6 text-4xl font-bold tracking-[-.045em] sm:text-5xl lg:text-6xl">Move Zimbabwe. Earn on work that fits you.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-secondary sm:text-lg">Drive riders, deliver prepared orders, shop for customers or move parcels — based on your city, vehicle and approvals. See the work and expected Driver pay before you accept.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href={applyHref}>Start my Driver application<ArrowRight className="h-5 w-5" /></Link></Button><Button asChild size="lg" variant="outline"><a href="#eligibility">Check what I can do</a></Button></div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-secondary"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Requirements match your vehicle</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Work types activate separately</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />Know the offer before accepting</span></div>
          <p className="mt-7 text-sm text-secondary">Already drive with Spotly? <Link href={signInHref} className="font-bold text-driver hover:underline">Sign in to Driver</Link></p>
        </div>
        <DriverPreview type={type} />
      </div>
    </section>

    <section id="work" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
      <div className="max-w-2xl"><p className="text-sm font-bold text-driver">Different work should feel different</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">Choose the work your vehicle and approvals unlock.</h2><p className="mt-4 text-base leading-7 text-secondary">Spotly Driver does not pretend a restaurant pickup, supermarket shop, passenger Ride and parcel Send are the same job. The offer and active workflow change with the work.</p></div>
      <div className="mt-8 grid gap-3 md:grid-cols-4">{WORK_TYPES.map((item) => { const Icon = item.icon; const active = item.id === activeType; return <button key={item.id} type="button" onClick={() => setActiveType(item.id)} className={`rounded-2xl border p-5 text-left transition ${active ? "border-driver bg-driver-soft shadow-sm" : "bg-[var(--surface)] hover:-translate-y-0.5 hover:border-driver/30 hover:shadow-card"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-driver text-[var(--on-accent)]" : "bg-grouped text-secondary"}`}><Icon className="h-5 w-5" /></span><p className="mt-4 font-bold">{item.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{item.eyebrow}</p></button>; })}</div>
      <div className="mt-5 grid gap-6 rounded-2xl border bg-[var(--surface)] p-6 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:p-8"><div><span className="text-xs font-bold uppercase tracking-[.14em] text-driver">{type.eyebrow}</span><h3 className="mt-2 text-2xl font-bold">{type.label} with the right workflow.</h3><p className="mt-3 leading-7 text-secondary">{type.description}</p><div className="mt-5 flex flex-wrap gap-2">{type.details.map((item) => <span key={item} className="rounded-full bg-grouped px-3 py-1.5 text-xs font-semibold">{item}</span>)}</div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[{ icon: WalletCards, label: "Expected pay" }, { icon: MapPin, label: "Pickup + route" }, { icon: Clock3, label: "Total work time" }, { icon: ShieldCheck, label: "Safe exceptions" }].map((item) => <div key={item.label} className="rounded-2xl bg-[var(--surface-2)] p-4"><item.icon className="h-5 w-5 text-driver" /><p className="mt-4 text-sm font-bold leading-5">{item.label}</p></div>)}</div></div>
    </section>

    <section id="how-it-works" className="border-y bg-[var(--surface-2)]">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl"><p className="text-sm font-bold text-driver">From curious to active</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">You should always know what stands between you and earning.</h2><p className="mt-4 leading-7 text-secondary">Driver onboarding is built around the work you want to do. Spotly separates what you need to complete from what Driver Operations is reviewing.</p></div>
        <div className="mt-9 grid gap-4 lg:grid-cols-4">{STEPS.map((item) => <div key={item.number} className="rounded-2xl border bg-[var(--surface)] p-6"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-driver-soft text-driver"><item.icon className="h-5 w-5" /></span><span className="text-sm font-bold text-tertiary">{item.number}</span></div><h3 className="mt-5 text-xl font-bold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-secondary">{item.text}</p></div>)}</div>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-driver/20 bg-driver-soft p-6 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-driver"><Bike className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="font-bold">A bicycle applicant should not be forced through car paperwork.</p><p className="mt-1 text-sm leading-6 text-secondary">Vehicle, city and requested work determine the evidence and training Spotly asks for. A new capability can be reviewed later without restarting your whole Driver account.</p></div><Button asChild variant="outline"><a href="#eligibility">Check requirements<ArrowRight className="h-4 w-4" /></a></Button></div>
      </div>
    </section>

    <section id="eligibility" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mb-8 max-w-2xl"><p className="text-sm font-bold text-driver">Check before creating an account</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">See the likely path for your city, vehicle and work.</h2><p className="mt-4 leading-7 text-secondary">This is a planner, not a promise of approval. It is here so you can understand what Spotly is likely to ask for before starting.</p></div>
      <DriverEligibilityPlanner entryHref={applyHref} />
    </section>

    <section id="driver-value" className="border-y bg-[var(--surface-2)]">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl"><p className="text-sm font-bold text-driver">A field app, not an office dashboard</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em] sm:text-4xl">Know if you can work. Know what to do next. Know what you earned.</h2><p className="mt-4 leading-7 text-secondary">The Driver workspace is designed around fast decisions on a phone: account readiness, GPS health, live offers, the active job, safety and money.</p></div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{VALUE.map((item) => <div key={item.title} className="rounded-2xl border bg-[var(--surface)] p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-driver-soft text-driver"><item.icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{item.text}</p></div>)}</div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border bg-[var(--surface)] p-6 lg:col-span-2"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-driver-soft text-driver"><HeartHandshake className="h-5 w-5" /></span><div><p className="font-bold">When something goes wrong, do not improvise alone.</p><p className="text-sm text-secondary">Restaurant delays, unavailable items, rider no-shows, parcel problems, breakdowns and safety concerns use job-aware actions instead of dumping you into a blank support form.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{["Order not ready", "Customer unreachable", "Vehicle issue"].map((item) => <div key={item} className="rounded-2xl bg-[var(--surface-2)] p-4"><ShieldCheck className="h-5 w-5 text-driver" /><p className="mt-3 text-sm font-bold">{item}</p></div>)}</div></div><div className="rounded-2xl bg-[var(--inverse-surface)] p-6 text-[var(--inverse-text)]"><ReceiptText className="h-7 w-7 text-driver" /><h3 className="mt-5 text-xl font-bold">Driver Money in plain language</h3><p className="mt-3 text-sm leading-6 text-[var(--inverse-text-muted)]">Today, available, cash obligation, payout readiness and earnings activity stay separated so you can understand what is actually yours.</p><div className="mt-6 rounded-2xl bg-[var(--surface)]/10 p-4"><p className="text-xs text-[var(--inverse-text-muted)]">Example status</p><p className="mt-1 text-2xl font-bold">Payout ready</p><p className="mt-1 text-xs text-driver">No account blocker</p></div></div></div>
      </div>
    </section>

    <section className="border-t bg-[var(--inverse-surface)] text-[var(--inverse-text)]">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16"><div className="max-w-2xl"><p className="text-sm font-bold text-driver">See your path before your first job.</p><h2 className="mt-2 text-3xl font-bold tracking-[-.035em]">Start with the work you can actually qualify for.</h2><p className="mt-4 leading-7 text-[var(--inverse-text-muted)]">Create or use your Spotly account, finish the requirements that apply to you, follow the review timeline and activate work types as they become ready.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-driver text-[var(--on-accent)] hover:bg-driver-strong"><Link href={applyHref}>Start driving<ArrowRight className="h-5 w-5" /></Link></Button><Button asChild size="lg" variant="outline" className="border-[var(--inverse-text-muted)]/30 bg-[var(--surface)]/5 text-[var(--inverse-text)] hover:bg-[var(--surface)]/10"><Link href={signInHref}>Sign in</Link></Button></div></div>
    </section>

    <footer className="border-t bg-[var(--surface)]"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-8 text-sm text-secondary sm:px-6 md:flex-row md:items-center"><div className="flex items-center gap-2"><Image src="/brand/spotly-driver.svg" alt="" width={28} height={28} /><span className="font-semibold text-[var(--text)]">Spotly Driver</span><span>· Move what matters.</span></div><div className="flex flex-wrap gap-x-5 gap-y-2 md:ml-auto"><Link href={spotlyPortalUrl("customer")} className="hover:text-[var(--text)]">Spotly</Link><Link href={spotlyPortalUrl("customer", "/support?topic=driver")} className="hover:text-[var(--text)]">Help</Link><Link href={spotlyPortalUrl("customer", "/privacy")} className="hover:text-[var(--text)]">Privacy</Link><Link href={spotlyPortalUrl("customer", "/terms")} className="hover:text-[var(--text)]">Terms</Link></div></div></footer>
  </main>;
}
