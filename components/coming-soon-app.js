"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Globe2,
  Headphones,
  Languages,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  UsersRound,
  X,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Modal, SearchField } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { joinWaitlist, searchBusinesses, submitPartnershipLead, track } from "@/lib/firebase-services";
import { zimbabweBusinesses } from "@/data/zimbabwe-businesses";

const highlights = [
  { icon: ShoppingBasket, title: "Pick up groceries with less effort", copy: "Discover nearby stores, build your basket, choose a pickup window, and receive clear updates." },
  { icon: Store, title: "Zimbabwean businesses, easier to find", copy: "Verified profiles, useful information, branch-level details, and a direct path for owners to claim their listing." },
  { icon: ShieldCheck, title: "Built for trust from day one", copy: "Ownership verification, activity history, careful permissions, and transparent support workflows." }
];

const launchCities = ["Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo", "Kwekwe", "Victoria Falls", "Across Zimbabwe"];

function Header({ onWaitlist }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/spotly.png" alt="Spotly" width={44} height={44} className="h-11 w-11 rounded-[15px] object-cover" priority />
          <div><span className="block text-lg font-black tracking-[-0.035em]">Spotly</span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-violet">Zimbabwe</span></div>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-secondary md:flex">
          <a href="#how-it-works" className="transition hover:text-ink">How it works</a>
          <a href="#businesses" className="transition hover:text-ink">For businesses</a>
          <Link href="/support" className="transition hover:text-ink">Support</Link>
          <Link href="/devstatus" className="transition hover:text-ink">Development status</Link>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href={user ? "/account" : "/login"}><Button variant="ghost">{user ? "Account" : "Sign in"}</Button></Link>
          <Button onClick={onWaitlist}>Join the waitlist</Button>
        </div>
        <button className="rounded-xl p-2 md:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
      </div>
      <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white p-5 md:hidden"><div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={44} height={44} className="rounded-[15px]" /><span className="text-lg font-black">Spotly</span></Link><button onClick={() => setOpen(false)} className="rounded-xl p-2"><X className="h-6 w-6" /></button></div><div className="mt-10 space-y-1">{[["How it works", "#how-it-works"], ["For businesses", "#businesses"], ["Support", "/support"], ["Development status", "/devstatus"], [user ? "Account" : "Sign in", user ? "/account" : "/login"]].map(([label, href]) => <Link key={label} href={href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl px-4 py-4 text-lg font-semibold hover:bg-violet-soft">{label}<ChevronRight className="h-5 w-5" /></Link>)}</div><Button onClick={() => { setOpen(false); onWaitlist(); }} className="mt-8 w-full">Join the waitlist</Button></motion.div>}</AnimatePresence>
    </header>
  );
}

function WaitlistModal({ open, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "Harare", interests: ["groceries"] });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

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

  return <Modal open={open} onClose={onClose} title={done ? "You're on the list" : "Join the Spotly waitlist"} size="sm">{done ? <div className="p-6 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-soft text-violet"><Check className="h-8 w-8" /></span><h3 className="mt-5 text-2xl font-bold">We will keep you close to launch.</h3><p className="mt-3 text-sm leading-6 text-secondary">We recorded your city and interests so launch updates can be relevant rather than noisy.</p><Button onClick={onClose} className="mt-6 w-full">Done</Button></div> : <form onSubmit={submit} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Full name</span><input className="surface h-12 w-full rounded-xl px-4 outline-none focus:ring-2 focus:ring-violet/25" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoComplete="name" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Email address</span><input type="email" className="surface h-12 w-full rounded-xl px-4 outline-none focus:ring-2 focus:ring-violet/25" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="email" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Phone number <span className="font-normal text-tertiary">(optional)</span></span><input type="tel" className="surface h-12 w-full rounded-xl px-4 outline-none focus:ring-2 focus:ring-violet/25" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+263" autoComplete="tel" /></label><label className="block"><span className="mb-2 block text-sm font-semibold">City</span><select className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })}>{launchCities.map((city) => <option key={city}>{city}</option>)}</select></label><div><span className="mb-2 block text-sm font-semibold">What matters most?</span><div className="flex flex-wrap gap-2">{[["groceries", "Grocery pickup"], ["businesses", "Local businesses"], ["beta", "Private beta"], ["partnerships", "Partnerships"]].map(([value, label]) => { const active = form.interests.includes(value); return <button type="button" key={value} onClick={() => setForm({ ...form, interests: active ? form.interests.filter((item) => item !== value) : [...form.interests, value] })} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? "border-violet bg-violet-soft text-violet-strong" : "border-line bg-white"}`}>{active && <Check className="mr-1 inline h-3.5 w-3.5" />}{label}</button>; })}</div></div><Button type="submit" loading={loading} className="w-full">Save my place<ArrowRight className="h-4 w-4" /></Button><p className="text-center text-xs leading-5 text-tertiary">By joining, you agree to receive relevant launch updates. You can opt out at any time.</p></form>}</Modal>;
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
      try {
        const remote = await searchBusinesses(term, 8);
        setResults(remote.length ? remote : zimbabweBusinesses.filter((business) => [business.name, business.brandName, business.city, business.category].join(" ").toLowerCase().includes(term)).slice(0, 8));
      } catch {
        setResults(zimbabweBusinesses.filter((business) => [business.name, business.brandName, business.city, business.category].join(" ").toLowerCase().includes(term)).slice(0, 8));
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  return <div className="relative"><SearchField value={query} onChange={setQuery} placeholder="Search your business name, brand, city, or category" className="h-14 border-white/20 bg-white shadow-elevated" /><AnimatePresence>{query.length >= 2 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute inset-x-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border bg-white text-ink shadow-elevated">{loading ? <div className="p-5 text-sm text-secondary">Searching provisional Spotly listings…</div> : results.length ? <div>{results.map((business) => <Link key={business.id} href={`/claim?business=${business.id}`} onClick={() => track("business_search_result_opened", { business_id: business.id })} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-0 hover:bg-violet-soft/60"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet"><Store className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{business.name}</span><span className="mt-1 block truncate text-xs text-secondary">{business.category} · {business.city} · Unclaimed</span></span><ChevronRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <div className="p-5"><p className="text-sm font-semibold">No close match found</p><p className="mt-1 text-sm text-secondary">You can add the business and continue with ownership verification.</p><Link href={`/claim?new=1&name=${encodeURIComponent(query)}`}><Button size="sm" className="mt-4">Add this business</Button></Link></div>}</motion.div>}</AnimatePresence></div>;
}

function PartnershipModal({ open, onClose }) {
  const [form, setForm] = useState({ organization: "", name: "", email: "", phone: "", type: "business_network", message: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  async function submit(event) { event.preventDefault(); setLoading(true); try { await submitPartnershipLead(form); toast("Your partnership interest has been sent.", { title: "Received" }); onClose(); } catch (error) { toast(error.message, { type: "error", title: "Could not send" }); } finally { setLoading(false); } }
  return <Modal open={open} onClose={onClose} title="Explore a Spotly partnership" size="sm"><form onSubmit={submit} className="space-y-4 p-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Organization</span><input required className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Your name</span><input required className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="mb-2 block text-sm font-semibold">Phone</span><input className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></div><label className="block"><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" required className="surface h-12 w-full rounded-xl px-4 outline-none" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="block"><span className="mb-2 block text-sm font-semibold">Partnership type</span><select className="surface h-12 w-full rounded-xl px-4" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="business_network">Business network or association</option><option value="payments">Payments or financial services</option><option value="logistics">Logistics or fulfilment</option><option value="data">Business directory or data</option><option value="media">Media or launch partner</option><option value="other">Other</option></select></label><label className="block"><span className="mb-2 block text-sm font-semibold">How could we work together?</span><textarea required className="surface min-h-28 w-full rounded-xl p-4 outline-none" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><Button type="submit" loading={loading} className="w-full">Send interest</Button></form></Modal>;
}

export function ComingSoonApp() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [partnershipOpen, setPartnershipOpen] = useState(false);
  const { settings } = usePlatform();
  const marketplaceEnabled = settings.launch?.marketplaceEnabled;

  useEffect(() => { track("coming_soon_viewed"); }, []);

  return <main className="min-h-screen bg-white text-ink" style={{ "--accent": "#6657d9", "--accent-strong": "#4e3fbf", "--accent-soft": "#f0eeff" }}><Header onWaitlist={() => setWaitlistOpen(true)} />
    <section className="relative overflow-hidden border-b border-black/5"><div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(102,87,217,.14),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(132,92,246,.12),transparent_31%),linear-gradient(#fff,#faf9ff)]" /><div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:pb-28 lg:pt-24"><div className="flex flex-col justify-center"><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex w-fit items-center gap-2 rounded-full border border-violet/15 bg-white px-3 py-2 text-xs font-bold text-violet shadow-card"><Sparkles className="h-4 w-4" />Built in Zimbabwe, for everyday Zimbabwe</motion.div><motion.h1 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }} className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">Find it. Pick it up. <span className="bg-gradient-to-r from-violet-strong via-violet to-fuchsia-500 bg-clip-text text-transparent">Get on with your day.</span></motion.h1><motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="mt-7 max-w-xl text-lg leading-8 text-secondary">Spotly is preparing a more useful way to discover Zimbabwean businesses and arrange grocery pickup—designed around clarity, trust, and less unnecessary work.</motion.p><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }} className="mt-8 flex flex-col gap-3 sm:flex-row"><Button size="lg" onClick={() => setWaitlistOpen(true)}>Join the launch list<ArrowRight className="h-5 w-5" /></Button><Link href="/claim"><Button size="lg" variant="outline"><Building2 className="h-5 w-5" />List or claim a business</Button></Link></motion.div><div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-secondary">{["English, ChiShona & isiNdebele", "Admin-controlled private beta", "Zimbabwe-wide directory"].map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />{item}</span>)}</div></div>
      <motion.div initial={{ opacity: 0, scale: .97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: .12, duration: .55 }} className="relative"><div className="absolute -inset-6 rounded-[42px] bg-violet/10 blur-3xl" /><div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white p-4 shadow-[0_30px_80px_rgba(75,55,150,.18)] sm:p-6"><div className="rounded-[24px] bg-gradient-to-br from-violet-strong via-violet to-fuchsia-500 p-6 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-white/70">Spotly preview</p><p className="mt-2 text-2xl font-bold">Your nearby grocery pickup</p></div><Image src="/brand/spotly.png" alt="" width={58} height={58} className="h-14 w-14 rounded-[18px] ring-1 ring-white/20" /></div><div className="mt-8 rounded-2xl bg-white/12 p-4 backdrop-blur"><div className="flex items-center gap-3"><Search className="h-5 w-5 text-white/70" /><span className="text-sm text-white/75">Milk, bread, tomatoes, airtime…</span></div></div><div className="mt-5 grid grid-cols-3 gap-3">{[["3", "stores nearby"], ["30 min", "pickup windows"], ["2", "currencies"]].map(([value, label]) => <div key={label} className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-[11px] text-white/70">{label}</p></div>)}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet shadow-card"><Store className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Store confirmed</p><p className="mt-1 text-xs text-secondary">Branch, hours, pickup details</p></div></div></div><div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-success shadow-card"><Clock3 className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Pickup at 17:30</p><p className="mt-1 text-xs text-secondary">Clear progress notifications</p></div></div></div></div></div></motion.div></div></section>

    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-violet">Intentional by design</p><h2 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Everything useful. Nothing unexplained.</h2><p className="mt-5 text-lg leading-8 text-secondary">Spotly should help people move forward. Every empty state, form, search, status, and notification is being designed to tell you what is happening and what to do next.</p></div><div className="mt-12 grid gap-5 lg:grid-cols-3">{highlights.map((item, index) => <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ delay: index * .07 }}><Card className="h-full p-6 sm:p-7"><span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-violet-soft text-violet"><item.icon className="h-6 w-6" /></span><h3 className="mt-6 text-xl font-bold">{item.title}</h3><p className="mt-3 text-sm leading-7 text-secondary">{item.copy}</p></Card></motion.div>)}</div></section>

    <section id="businesses" className="bg-[#171329] text-white"><div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-28"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">For Zimbabwean businesses</p><h2 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Your listing may already be waiting for you.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-white/65">We are preparing provisional business profiles so owners can start by confirming information instead of typing everything from scratch. Search first, claim what belongs to you, and correct anything that needs attention.</p><div className="mt-8 space-y-4">{[[BadgeCheck, "Manual verification with configurable low-risk automation"], [Globe2, "Multiple brands and branches under one organization"], [Zap, "Pre-filled onboarding, autosave, and useful defaults"], [Headphones, "Live support available to visitors, customers, and businesses"]].map(([Icon, text]) => <div key={text} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-violet-200"><Icon className="h-4 w-4" /></span><span className="text-sm font-semibold text-white/85">{text}</span></div>)}</div></div><div><div className="rounded-[28px] border border-white/10 bg-white/7 p-5 shadow-2xl backdrop-blur"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Find your business</p><p className="mt-1 text-xs text-white/50">Search provisional listings across Zimbabwe</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70">UNCLAIMED LISTINGS</span></div><div className="mt-5 text-ink"><BusinessFinder /></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Link href="/claim?new=1" className="flex-1"><Button className="w-full bg-white text-violet-strong hover:bg-white/90">Add a new business</Button></Link><Button variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={() => setPartnershipOpen(true)}>Discuss a partnership</Button></div><p className="mt-4 text-xs leading-5 text-white/45">Listings imported from public sources remain provisional until reviewed. Businesses can correct, claim, or request removal.</p></div></div></div></section>

    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-5 lg:grid-cols-4">{[[UsersRound, "One shared account", "Use one Spotly identity across customer, business, and permitted admin experiences."], [Languages, "Three languages", "English, ChiShona, and isiNdebele are part of the platform structure."], [BellRing, "Relevant notifications", "Email, in-app, browser, and push channels with clear preferences."], [ShieldCheck, "Admin-controlled release", marketplaceEnabled ? "The marketplace is currently enabled by administration." : "The public marketplace remains behind a controlled launch setting."]].map(([Icon, title, text]) => <Card key={title} className="p-5"><Icon className="h-5 w-5 text-violet" /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-secondary">{text}</p></Card>)}</div></section>

    <section className="px-4 pb-20 sm:px-6"><div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-strong via-violet to-fuchsia-500 p-7 text-white sm:p-10 lg:flex lg:items-center lg:justify-between lg:p-14"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-white/65">The next useful thing</p><h2 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.045em]">Know when Spotly is ready where you are.</h2><p className="mt-4 max-w-2xl leading-7 text-white/75">Tell us your city and what you care about. We will use that context to make launch communication more relevant.</p></div><Button size="lg" className="mt-7 bg-white text-violet-strong hover:bg-white/90 lg:mt-0" onClick={() => setWaitlistOpen(true)}>Join the waitlist<ArrowRight className="h-5 w-5" /></Button></div></section>

    <footer className="border-t bg-grouped"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto_auto] lg:px-8"><div><div className="flex items-center gap-3"><Image src="/brand/spotly.png" alt="Spotly" width={40} height={40} className="rounded-[13px]" /><span className="font-black">Spotly</span></div><p className="mt-3 max-w-md text-sm leading-6 text-secondary">A more intentional way to discover local businesses and prepare grocery pickup across Zimbabwe.</p></div><div><p className="text-xs font-bold uppercase tracking-[.15em] text-tertiary">Platform</p><div className="mt-3 space-y-2 text-sm font-semibold"><Link className="block" href="/business">Business portal</Link><Link className="block" href="/admin">Admin portal</Link><Link className="block" href="/devstatus">Development status</Link></div></div><div><p className="text-xs font-bold uppercase tracking-[.15em] text-tertiary">Help</p><div className="mt-3 space-y-2 text-sm font-semibold"><Link className="block" href="/support">Live support</Link><Link className="block" href="/claim">Claim a business</Link><Link className="block" href="/login">Sign in</Link></div></div></div><div className="border-t px-4 py-5 text-center text-xs text-tertiary">© {new Date().getFullYear()} Spotly. Provisional business listings are subject to verification.</div></footer>
    <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} /><PartnershipModal open={partnershipOpen} onClose={() => setPartnershipOpen(false)} />
  </main>;
}
