"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  HeartPulse,
  Home,
  MapPin,
  Menu,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Ticket,
  Utensils,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Modal, SearchField } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth } from "@/components/firebase-provider";
import { joinWaitlist, searchBusinesses, track } from "@/lib/firebase-services";

const launchCities = ["Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo", "Kwekwe", "Victoria Falls", "Another area"];
const categories = [
  { icon: ShoppingBasket, title: "Groceries", copy: "Everyday essentials and weekly shopping." },
  { icon: Utensils, title: "Prepared food", copy: "Order ahead from nearby kitchens." },
  { icon: HeartPulse, title: "Health", copy: "Pharmacies and personal care." },
  { icon: Home, title: "Home essentials", copy: "Useful things without an extra trip." },
  { icon: Wrench, title: "Services", copy: "Find trusted local providers." },
  { icon: Ticket, title: "Events", copy: "Discover what is happening nearby." }
];

function Header({ onWaitlist }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const links = [["Explore", "#explore"], ["How pickup works", "#how-it-works"], ["For businesses", "#businesses"], ["Help", "/support"]];
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fffdf9]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Spotly home">
          <Image src="/brand/spotly.svg" alt="" width={42} height={42} className="h-10 w-10" priority />
          <span className="text-xl font-semibold tracking-[-0.025em]">Spotly</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-secondary md:flex" aria-label="Public navigation">
          {links.map(([label, href]) => href.startsWith("#") ? <a key={label} href={href} className="transition hover:text-ink">{label}</a> : <Link key={label} href={href} className="transition hover:text-ink">{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost"><Link href={user ? "/account" : "/login"}>{user ? "Account" : "Sign in"}</Link></Button>
          <Button onClick={onWaitlist}>Join the launch list</Button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Button size="sm" onClick={onWaitlist}>Join</Button>
          <button className="rounded-lg p-2" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
        </div>
      </div>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#fffdf9] p-5 md:hidden">
          <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="" width={42} height={42} /><span className="text-xl font-semibold">Spotly</span></Link><button onClick={() => setOpen(false)} className="rounded-lg p-2" aria-label="Close navigation"><X className="h-6 w-6" /></button></div>
          <nav className="mt-10 space-y-1" aria-label="Mobile public navigation">{[...links, [user ? "Account" : "Sign in", user ? "/account" : "/login"]].map(([label, href]) => <Link key={label} href={href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-4 py-4 text-lg font-semibold hover:bg-violet-soft">{label}<ChevronRight className="h-5 w-5" /></Link>)}</nav>
          <Button onClick={() => { setOpen(false); onWaitlist(); }} className="mt-8 w-full">Join the launch list</Button>
        </motion.div>
      )}</AnimatePresence>
    </header>
  );
}

function WaitlistModal({ open, onClose, initialCity = "Harare" }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: initialCity, interests: ["groceries"] });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open && initialCity) setForm((value) => ({ ...value, city: initialCity })); }, [open, initialCity]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await joinWaitlist(form);
      setDone(true);
      toast("You are on the Spotly launch list.", { title: "You're in" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not join" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={done ? "You're on the list" : "Join the Spotly launch list"} description={done ? undefined : "Tell us where you are so we can send relevant launch updates."} size="sm">
      {done ? (
        <div className="p-6 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-violet-soft text-violet"><Check className="h-8 w-8" /></span><h3 className="mt-5 text-2xl font-semibold">We will let you know when Spotly reaches your area.</h3><p className="mt-3 text-sm leading-6 text-secondary">You can update your details or leave the list from any launch email.</p><Button onClick={onClose} className="mt-6 w-full">Done</Button></div>
      ) : (
        <form onSubmit={submit} className="space-y-4 p-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold">Full name</span><input className="input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoComplete="name" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Email address</span><input type="email" className="input w-full" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">WhatsApp or phone <span className="font-normal text-tertiary">optional</span></span><input type="tel" className="input w-full" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+263" autoComplete="tel" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Area</span><select className="input w-full" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })}>{launchCities.map((city) => <option key={city}>{city}</option>)}</select></label>
          <div><span className="mb-2 block text-sm font-semibold">What would you use first?</span><div className="flex flex-wrap gap-2">{[["groceries", "Groceries"], ["food", "Prepared food"], ["services", "Services"], ["events", "Events"]].map(([value, label]) => { const active = form.interests.includes(value); return <button type="button" key={value} onClick={() => setForm({ ...form, interests: active ? form.interests.filter((item) => item !== value) : [...form.interests, value] })} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? "border-violet bg-violet-soft text-violet-strong" : "border-line bg-white"}`}>{active && <Check className="mr-1 inline h-3.5 w-3.5" />}{label}</button>; })}</div></div>
          <Button type="submit" loading={loading} className="w-full">Save my place<ArrowRight className="h-4 w-4" /></Button>
          <p className="text-center text-xs leading-5 text-tertiary">We will send launch updates only. You can opt out at any time.</p>
        </form>
      )}
    </Modal>
  );
}

function BusinessFinder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const term = query.trim().toLowerCase();
      if (term.length < 2) { setResults([]); return; }
      setLoading(true);
      try { setResults(await searchBusinesses(term, 8)); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <SearchField value={query} onChange={setQuery} label="Find your business" placeholder="Business name, city or category" className="h-14 bg-white" />
      <AnimatePresence>{query.length >= 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute inset-x-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-xl border bg-white text-ink shadow-elevated">
          {loading ? <div className="p-5 text-sm text-secondary">Searching businesses…</div> : results.length ? <div>{results.map((business) => <Link key={business.id} href={`/claim?business=${business.id}`} onClick={() => track("business_search_result_opened", { business_id: business.id })} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-0 hover:bg-violet-soft/60"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-soft text-violet"><Store className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{business.name}</span><span className="mt-1 block truncate text-xs text-secondary">{[business.category, business.city].filter(Boolean).join(" · ") || "Business listing"}</span></span><ChevronRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <div className="p-5"><p className="text-sm font-semibold">No close match found</p><p className="mt-1 text-sm text-secondary">Add the business and we will review the details.</p><Button asChild size="sm" className="mt-4"><Link href={`/claim?new=1&name=${encodeURIComponent(query)}`}>Add this business</Link></Button></div>}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

function ProductStory() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-8 rounded-[40px] bg-violet/10 blur-3xl" />
      <div className="relative grid gap-4 rounded-[20px] border border-black/8 bg-white p-4 shadow-[0_28px_80px_rgba(62,48,130,.16)] sm:grid-cols-[1fr_180px] sm:p-5"><span className="absolute -top-3 left-5 rounded-full border bg-white px-3 py-1 text-[10px] font-semibold text-secondary shadow-sm">Illustrative product preview</span>
        <div className="rounded-xl bg-[#f6f2ea] p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-violet">Nearby in Harare</p><p className="mt-1 text-xl font-semibold">Today’s pickup</p></div><Image src="/brand/spotly.svg" alt="" width={42} height={42} /></div>
          <div className="mt-5 rounded-lg border bg-white p-3"><div className="flex items-center gap-2 text-sm text-secondary"><Search className="h-4 w-4" />Milk, bread, tomatoes</div></div>
          <div className="mt-4 space-y-2">{[["FreshMart Avondale", "12 min away", "Open"], ["Corner Store Milton Park", "18 min away", "Open"], ["Food Basket Belgravia", "24 min away", "Soon"]].map(([name, distance, status], index) => <div key={name} className="flex items-center gap-3 rounded-lg bg-white p-3"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${index === 0 ? "bg-violet text-white" : "bg-violet-soft text-violet"}`}><Store className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{name}</span><span className="mt-1 block text-xs text-secondary">{distance}</span></span><span className="text-xs font-semibold text-success">{status}</span></div>)}</div>
        </div>
        <div className="flex flex-col justify-between rounded-xl bg-[#171329] p-5 text-white">
          <div><p className="text-xs font-semibold text-white/55">ORDER STATUS</p><div className="mt-5 space-y-5">{[[Check, "Order received"], [ShoppingBasket, "Being prepared"], [Clock3, "Ready at 17:30"]].map(([Icon, label], index) => <div key={label} className="flex gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${index < 2 ? "bg-violet" : "bg-white/10"}`}><Icon className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{label}</p>{index === 1 && <p className="mt-1 text-xs text-white/55">2 of 8 items packed</p>}</div></div>)}</div></div>
          <div className="mt-8 rounded-lg bg-white p-3 text-ink"><p className="text-xs text-secondary">Pickup location</p><p className="mt-1 text-sm font-semibold">Avondale, Harare</p><p className="mt-3 text-xs font-semibold text-violet">View pickup details →</p></div>
        </div>
      </div>
    </div>
  );
}

export function ComingSoonApp() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Harare");
  useEffect(() => { track("coming_soon_viewed"); }, []);

  return (
    <main className="min-h-screen bg-[#fffdf9] text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}>
      <Header onWaitlist={() => setWaitlistOpen(true)} />

      <section className="relative overflow-hidden border-b border-black/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(102,87,217,.12),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(231,172,91,.16),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[.95fr_1.05fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="flex flex-col justify-center">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex w-fit items-center gap-2 rounded-full border border-violet/15 bg-white px-3 py-2 text-xs font-semibold text-violet"><MapPin className="h-4 w-4" />Preparing for launch in Zimbabwe</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .04 }} className="max-w-3xl text-[44px] font-semibold leading-[.98] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">Find what you need nearby. <span className="text-violet">Collect it when it is ready.</span></motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }} className="mt-6 max-w-xl text-lg leading-8 text-secondary">Spotly will help you find nearby businesses, order ahead and spend less time waiting in queues.</motion.p>
            <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }} onSubmit={(event) => { event.preventDefault(); setWaitlistOpen(true); }} className="mt-8 flex max-w-xl flex-col gap-3 rounded-xl border bg-white p-3 shadow-card sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-3 px-2"><MapPin className="h-5 w-5 text-violet" /><span className="sr-only">Your area</span><select aria-label="Your area" value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none">{launchCities.map((city) => <option key={city}>{city}</option>)}</select></label>
              <Button type="submit" className="sm:min-w-44">Join the launch list<ArrowRight className="h-4 w-4" /></Button>
            </motion.form>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />No launch spam</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />Exact location before ordering</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />Clear pickup updates</span></div>
          </div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12, duration: .5 }} className="flex items-center"><ProductStory /></motion.div>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-violet">Explore nearby</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Start with what you need today.</h2></div><p className="max-w-md text-sm leading-6 text-secondary">The first release will focus on useful local discovery and pickup. More categories will open as businesses are ready.</p></div>
        <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{categories.map(({ icon: Icon, title, copy }, index) => <Card key={title} className="group p-4 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-elevated"><span className={`flex h-11 w-11 items-center justify-center rounded-lg ${index === 0 ? "bg-violet text-white" : "bg-[#f4efe6] text-[#664c2a]"}`}><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 hidden text-xs leading-5 text-secondary sm:block">{copy}</p></Card>)}</div>
      </section>

      <section id="how-it-works" className="border-y border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-violet">How pickup works</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Three clear steps. No guessing.</h2></div>
          <div className="mt-10 grid gap-8 lg:grid-cols-3">{[[Search, "Search nearby", "Set your area, search for what you need and compare nearby businesses."], [MapPin, "Choose the exact location", "See the location, opening status and available pickup options before adding items."], [PackageCheck, "Collect when notified", "Follow the order from received to ready, then collect from the confirmed location."]].map(([Icon, title, copy], index) => <div key={title} className="relative border-t pt-6"><span className="text-sm font-semibold text-violet">0{index + 1}</span><span className="mt-5 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-soft text-violet"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="mt-3 max-w-sm text-sm leading-7 text-secondary">{copy}</p></div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div><p className="text-sm font-semibold text-violet">Launch area</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">A controlled pickup pilot, starting where businesses are ready.</h2><p className="mt-5 max-w-xl text-base leading-7 text-secondary">Spotly is not open for general ordering yet. People on the launch list will be invited by area as verified businesses, support and pickup operations become available.</p><div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => setWaitlistOpen(true)}>Join for {selectedCity}</Button><Button asChild variant="outline"><Link href="/support">Read launch help</Link></Button></div></div>
          <div className="grid gap-3 sm:grid-cols-2">{[[BadgeCheck, "Reviewed business details", "Businesses confirm their public information before ordering opens."], [MapPin, "Location-level clarity", "Customers choose the exact branch or operating location."], [Clock3, "Visible pickup progress", "Orders show what is happening and when collection is expected."], [ShieldCheck, "Help when needed", "Order and listing issues connect to a clear support path."]].map(([Icon, title, copy]) => <Card key={title} className="p-5"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-soft text-violet"><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{copy}</p></Card>)}</div>
        </div>
      </section>

      <section id="businesses" className="bg-[#171329] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-24">
          <div><p className="text-sm font-semibold text-violet-300">For business owners</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Your Spotly listing may already be prepared.</h2><p className="mt-5 max-w-xl text-base leading-7 text-white/65">Find the business, confirm your relationship and continue from existing public details instead of starting from an empty form.</p><div className="mt-7 space-y-3 text-sm text-white/80">{["Confirm the business and exact locations", "Correct public information", "Prepare products or services before launch", "Track the review from one place"].map((item) => <div key={item} className="flex items-center gap-3"><Check className="h-4 w-4 text-violet-300" />{item}</div>)}</div></div>
          <div className="rounded-[20px] border border-white/10 bg-white/7 p-5 backdrop-blur"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-violet-200"><Building2 className="h-5 w-5" /></span><div><p className="font-semibold">Find your business</p><p className="mt-1 text-xs text-white/50">Search by name, category or city</p></div></div><div className="mt-5 text-ink"><BusinessFinder /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Button asChild className="bg-white text-violet-strong hover:bg-white/90"><Link href="/claim">Find my business</Link></Button><Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10"><Link href="/claim?new=1">Add a business</Link></Button></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold text-violet">Questions before launch</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">What to expect.</h2><p className="mt-4 text-sm leading-7 text-secondary">Spotly is opening in stages. These answers will be updated as each area becomes ready.</p></div><div className="divide-y border-y">{[["Is Spotly live?", "The public website and business claiming are available. Customer ordering opens by invitation during the pilot."], ["Where will it launch first?", "Invitations will be based on areas with verified businesses and working pickup operations. Join the list with your city."], ["Does joining cost anything?", "Joining the launch list is free. Any future customer or business fees will be shown before an action is confirmed."], ["Will delivery be available?", "The first customer release is pickup focused. Delivery will open only after the driver and support experience is ready."], ["Which payments will be supported?", "The pilot is being prepared for USD and ZiG workflows, including Paynow-supported methods and approved pay-at-pickup options."]].map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{question}<ChevronRight className="h-5 w-5 transition group-open:rotate-90" /></summary><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">{answer}</p></details>)}</div></div>
      </section>

      <section className="px-4 pb-16 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[20px] bg-violet p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-white/65">Launch updates for your area</p><h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.035em]">Know when Spotly is ready near you.</h2></div><Button size="lg" className="bg-white text-violet-strong hover:bg-white/90" onClick={() => setWaitlistOpen(true)}>Join the launch list<ArrowRight className="h-5 w-5" /></Button></div></section>

      <footer className="border-t bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto_auto] lg:px-8"><div><div className="flex items-center gap-3"><Image src="/brand/spotly.svg" alt="" width={38} height={38} /><span className="text-lg font-semibold">Spotly</span></div><p className="mt-3 max-w-md text-sm leading-6 text-secondary">Find nearby businesses, order ahead and collect when it is ready.</p></div><div><p className="text-xs font-semibold text-tertiary">For customers</p><div className="mt-3 space-y-2 text-sm font-medium"><Link className="block" href="/support">Help</Link><Link className="block" href="/login">Sign in</Link><Link className="block" href="/privacy">Privacy</Link><Link className="block" href="/terms">Terms</Link><button className="block" onClick={() => setWaitlistOpen(true)}>Join the launch list</button></div></div><div><p className="text-xs font-semibold text-tertiary">For businesses</p><div className="mt-3 space-y-2 text-sm font-medium"><Link className="block" href="/claim">Find or add a business</Link><Link className="block" href="/business">Business sign in</Link><Link className="block" href="/support">Business help</Link></div></div></div><div className="border-t px-4 py-5 text-center text-xs text-tertiary">© {new Date().getFullYear()} Spotly. Launch availability varies by area.</div></footer>
      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} initialCity={selectedCity} />
    </main>
  );
}
