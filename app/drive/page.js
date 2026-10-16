import Image from "next/image";
import Link from "next/link";
import { Bike, CarFront, CheckCircle2, ChevronRight, MapPin, Package, ShieldCheck, WalletCards } from "lucide-react";
import { Button } from "@/components/ui";
import { ServiceArtwork } from "@/components/service-artwork";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

export const metadata = { title: "Drive and deliver with Spotly", description: "Apply to drive rides, deliveries and Send jobs with Spotly. See the route and expected earnings before you accept." };

const work = [
  { icon: CarFront, title: "Rides", text: "Pick up riders and complete verified city trips where Spotly Ride is enabled." },
  { icon: Bike, title: "Deliveries", text: "Move prepared orders or shop-and-deliver jobs from participating businesses." },
  { icon: Package, title: "Send", text: "Collect and deliver parcels with pickup and recipient verification." }
];

const benefits = [
  [WalletCards, "Know the work before you accept", "See the route, work type and expected Driver earnings before accepting an offer."],
  [MapPin, "One clear next step", "Pickup, verification, trip and completion states stay explicit while you are working."],
  [ShieldCheck, "Safety and support stay close", "Report incidents, handoff problems or route issues from the active job instead of hunting for help."],
  [CheckCircle2, "Your status is always visible", "Know whether you are online, available, assigned or already handling work at a glance."]
];

export default function DrivePage() {
  return <main className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5"><Image src="/brand/spotly.svg" alt="" width={38} height={38} /><span className="text-[17px] font-semibold tracking-[-.03em]">Spotly</span></Link>
        <span className="ml-2 hidden rounded-full bg-[var(--driver-soft)] px-3 py-1.5 text-xs font-semibold text-driver sm:inline-flex">Driver</span>
        <div className="ml-auto flex items-center gap-2"><Button asChild variant="ghost"><Link href="/support?topic=driver">Help</Link></Button><Button asChild variant="outline"><Link href={spotlyPortalUrl("driver", "/login?portal=driver")}>Sign in</Link></Button></div>
      </div>
    </header>

    <section className="overflow-hidden border-b border-[var(--border-subtle)]">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-driver">Spotly Driver</p>
          <h1 className="mt-3 text-[48px] font-semibold leading-[.98] tracking-[-.06em] sm:text-[64px]">Move your city. Know what comes next.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--text-2)] sm:text-lg">Drive rides, deliveries and parcel jobs when those services are live in your area. Spotly shows the work and expected earnings before you accept.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href={spotlyPortalUrl("driver")}>Start Driver application<ChevronRight className="h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline"><Link href="#how-it-works">How it works</Link></Button></div>
          <p className="mt-4 max-w-xl text-xs leading-5 text-[var(--text-3)]">Availability, work types and requirements vary by launch city, vehicle and approval status. Spotly only exposes work your account is eligible to accept.</p>
        </div>
        <div className="relative min-h-[390px] overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#2454b8,#2f76e7)] p-6 text-[var(--service-foreground)] shadow-[0_30px_90px_rgba(37,99,235,.18)] sm:p-8">
          <span className="spotly-path-line" aria-hidden="true" />
          <ServiceArtwork service="ride" className="absolute -right-1 top-2 h-44 w-44 opacity-90 sm:h-52 sm:w-52" />
          <div className="relative z-10 flex h-full min-h-[326px] flex-col justify-between">
            <div><span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--service-foreground)_14%,transparent)] px-3 py-2 text-xs font-semibold">Driver workspace</span><h2 className="mt-5 max-w-sm text-3xl font-semibold tracking-[-.045em]">Online. Clear. Ready for the next offer.</h2></div>
            <div className="grid gap-2 sm:grid-cols-3">{work.map(({ icon: Icon, title }) => <div key={title} className="rounded-[16px] bg-[color-mix(in_srgb,var(--service-foreground)_12%,transparent)] p-3 backdrop-blur"><Icon className="h-5 w-5" /><p className="mt-5 text-sm font-semibold">{title}</p></div>)}</div>
          </div>
        </div>
      </div>
    </section>

    <section id="how-it-works" className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="max-w-2xl"><p className="text-sm font-semibold text-driver">Three kinds of work. One Driver system.</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Take the work that fits your approval and vehicle.</h2></div>
      <div className="mt-9 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">{work.map(({ icon: Icon, title, text }, index) => <div key={title} className="grid gap-4 py-6 sm:grid-cols-[64px_180px_1fr_auto] sm:items-center"><span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--driver-soft)] text-driver"><Icon className="h-5 w-5" /></span><h3 className="text-lg font-semibold">{title}</h3><p className="max-w-2xl text-sm leading-6 text-[var(--text-2)]">{text}</p><span className="text-xs font-semibold text-[var(--text-3)]">0{index + 1}</span></div>)}</div>

      <div className="mt-16 grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
        <div><p className="text-sm font-semibold text-driver">Built for a working shift</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">The Driver app should answer four questions immediately.</h2><div className="mt-7 space-y-3 text-lg font-semibold"><p>Am I online?</p><p>Is there work?</p><p>What do I do next?</p><p>How much have I earned?</p></div></div>
        <div className="grid gap-x-8 border-t border-[var(--border-subtle)] sm:grid-cols-2">{benefits.map(([Icon,title,text]) => <div key={title} className="border-b border-[var(--border-subtle)] py-6"><Icon className="h-5 w-5 text-driver" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{text}</p></div>)}</div>
      </div>

      <div className="mt-16 rounded-[24px] bg-[var(--surface-2)] p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8"><div><h2 className="text-2xl font-semibold tracking-[-.035em]">Ready to apply?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Add your identity, vehicle and required documents. Spotly shows exactly what remains before you can go online.</p></div><Button asChild size="lg" className="mt-6 lg:mt-0"><Link href={spotlyPortalUrl("driver")}>Open Driver application<ChevronRight className="h-4 w-4" /></Link></Button></div>
    </section>

    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-8 text-sm text-[var(--text-3)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><span>Spotly Driver · Zimbabwe</span><div className="flex gap-5"><Link href="/support?topic=driver">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div></footer>
  </main>;
}
