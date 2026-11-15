"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, MapPin, Search, ShieldCheck, ShoppingBag, Store, Ticket, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui";
import { spotlyLoginUrl, spotlyPortalUrl } from "@/lib/spotly-domains";
import { publicApiFetch } from "@/lib/api-client";

// LX7: This page intentionally renders no sample revenue, orders, payouts, or invented
// merchant activity. Actual operational numbers belong in authenticated workspaces.
const SERVICES = [
  { icon: UtensilsCrossed, name: "Food & drink", description: "Menus and orders" },
  { icon: ShoppingBag, name: "Shops", description: "Products and pickup" },
  { icon: CalendarDays, name: "Services", description: "Appointments" },
  { icon: Ticket, name: "Experiences", description: "Bookings and tickets" }
];

const JOURNEY = [
  { icon: Search, title: "Find your business", detail: "Search existing listings so you don't need to enter the same information twice." },
  { icon: ShieldCheck, title: "Confirm your connection", detail: "Tell us who you are. We verify authority before allowing business operations." },
  { icon: Check, title: "Make it yours", detail: "Once approved, use a guided workspace to complete only the setup your business needs." }
];

export function BusinessMarketingPage({ loginHref }) {
  const signInHref = loginHref || spotlyLoginUrl("business", { next: "/", mode: "signin" });
  const startHref = spotlyPortalUrl("business", "/get-started");
  // The public promotion is deliberately invisible until BOTH the environment
  // release gate and Admin's approved/date-bounded policy permit it.
  const [offer, setOffer] = useState(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SPOTLY_COMMERCIAL_OFFER_VISIBLE !== "true") return;
    let mounted = true;
    publicApiFetch("/api/public/commercial-offer").then((result) => {
      if (mounted) setOffer(result.offer || null);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return <main data-workspace="business" className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--background)_93%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Spotly Business home">
          <Image src="/api/branding/assets/business_symbol_color.svg" alt="" width={36} height={36} className="h-9 w-9" />
          <span className="text-base font-semibold tracking-[-.02em]">Spotly Business</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link href={signInHref} className="rounded-xl px-3 py-2 text-sm font-medium text-secondary transition hover:bg-grouped hover:text-[var(--text)]">Sign in</Link>
          <Button asChild size="sm"><Link href={startHref}>Get started<ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </div>
    </header>

    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute right-[-12%] top-[-26%] h-[540px] w-[540px] rounded-full bg-business/5 blur-[80px]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-36">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-business">A simpler way to run your business</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-.06em] sm:text-6xl lg:text-[4.6rem]">Your business.<span className="block text-business">More possibilities.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-secondary sm:text-lg">Help people find you, keep your business details together and manage the services you choose to offer on Spotly.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg"><Link href={startHref}>Get started<ArrowRight className="h-5 w-5" /></Link></Button>
            <Link href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-secondary transition hover:text-business">How it works <ChevronRight className="h-4 w-4" /></Link>
          </div>
          {offer && <div className="mt-6 rounded-2xl border border-business/25 bg-business-soft p-4"><p className="text-sm font-semibold text-business">{offer.headline}</p><p className="mt-2 text-xs leading-5 text-secondary">For eligible businesses that accept the offer during its enrollment window. A commission waiver is not a waiver of delivery charges or payment-provider fees. <a className="underline" href={offer.termsUrl} target="_blank" rel="noopener noreferrer">Full terms</a></p></div>}
          <p className="mt-5 text-sm leading-6 text-secondary">Already managing a business? <Link href={signInHref} className="font-semibold text-business underline-offset-4 hover:underline">Sign in</Link></p>
        </div>
        <div className="relative mx-auto w-full max-w-md rounded-[32px] border bg-[var(--surface)] p-5 shadow-elevated sm:p-7" aria-label="Examples of business tools available in Spotly">
          <div className="flex items-center gap-3 border-b pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business-soft text-business"><Store className="h-6 w-6" /></span>
            <div><p className="text-sm font-semibold">Made for your business</p><p className="mt-1 text-xs text-secondary">Choose what you want to offer</p></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {SERVICES.map(({ icon: Icon, name, description }) => <div key={name} className="rounded-2xl border bg-[var(--surface-2)] p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-business"><Icon className="h-5 w-5" /></span><h2 className="mt-5 text-sm font-semibold">{name}</h2><p className="mt-1 text-xs leading-5 text-secondary">{description}</p></div>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-secondary">Tools and availability depend on your business type, location and approval status.</p>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-xl"><p className="text-sm font-semibold text-business">Getting started</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Start with the business. We'll guide the rest.</h2><p className="mt-4 leading-7 text-secondary">No need to decide on every product, location or setting up front.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {JOURNEY.map(({ icon: Icon, title, detail }, index) => <div key={title} className="rounded-3xl border bg-[var(--surface)] p-6 sm:p-7"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-business-soft text-business"><Icon className="h-5 w-5" /></span><span className="text-xs font-medium tabular-nums text-tertiary">0{index + 1}</span></div><h3 className="mt-8 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-secondary">{detail}</p></div>)}
      </div>
      <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-[var(--surface-2)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-business" /><div><h3 className="font-semibold">Your business stays protected.</h3><p className="mt-1 max-w-xl text-sm leading-6 text-secondary">You can save your application as you go. Operating permissions and public commerce are only enabled after the required checks.</p></div></div><Button asChild variant="outline"><Link href={startHref}>Find my business<ArrowRight className="h-4 w-4" /></Link></Button></div>
    </section>

    <section className="border-y bg-[var(--surface-2)]"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:py-24"><div><p className="text-sm font-semibold text-business">Designed for everyday work</p><h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Everything in the right place.</h2><p className="mt-4 max-w-lg text-base leading-7 text-secondary">See what needs attention, update what customers see and review financial information when your account has the right permissions.</p></div><div className="grid gap-3">{[{ icon: MapPin, title: "Be easy to find", text: "Locations and business details customers can trust" }, { icon: Clock3, title: "Know what comes next", text: "Clear setup and operational tasks for your business" }, { icon: ShieldCheck, title: "Keep control", text: "Verified ownership, team access and transparent account status" }].map(({ icon: Icon, title, text }) => <div key={title} className="flex items-start gap-4 rounded-2xl border bg-[var(--surface)] p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Icon className="h-5 w-5" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-secondary">{text}</p></div></div>)}</div></div></section>

    <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-24"><h2 className="max-w-xl text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Ready when you are.</h2><p className="max-w-xl leading-7 text-secondary">Search for your business. If it isn't listed, you can add it during the same guided process.</p><Button asChild size="lg"><Link href={startHref}>Get started<ArrowRight className="h-5 w-5" /></Link></Button></section>
    <footer className="border-t px-4 py-8 sm:px-6"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-secondary"><span>© {new Date().getFullYear()} Spotly Business</span><div className="flex flex-wrap gap-x-5 gap-y-2"><Link href={spotlyPortalUrl("customer", "/terms")} className="hover:underline">Terms</Link><Link href={spotlyPortalUrl("customer", "/privacy")} className="hover:underline">Privacy</Link><Link href={spotlyPortalUrl("customer", "/help")} className="hover:underline">Help</Link></div></div></footer>
  </main>;
}
