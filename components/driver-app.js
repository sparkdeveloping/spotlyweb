"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeDollarSign,
  BellRing,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Headphones,
  History,
  IdCard,
  LocateFixed,
  LockKeyhole,
  Map,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Play,
  ShieldCheck,
  Star,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { BarChart, Sparkline } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ListRow,
  MetricCard,
  Modal,
  PageHeader,
  ProgressBar,
  SearchField,
  SectionCard,
  StatusBadge,
  Tabs
} from "@/components/ui";
import { useToast } from "@/components/providers";
import { activeJob as activeJobSeed, driverMetrics, earningsSeries, jobHistory, jobOffers as initialJobOffers, weeklyEarnings } from "@/data/driver";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";

const sectionMeta = {
  home: { title: "Driver home", description: "Your shift, live demand, and next best action." },
  jobs: { title: "Available jobs", description: "Review dispatch offers and choose the right work." },
  active: { title: "Active job", description: "Complete the delivery safely and keep the customer informed." },
  earnings: { title: "Earnings", description: "Track pay, tips, bonuses, and payout history." },
  history: { title: "Job history", description: "Your completed work, incidents, and shift records." },
  support: { title: "Safety & support", description: "Get help quickly and report anything that needs attention." },
  profile: { title: "Driver profile", description: "Manage verification, vehicle, documents, and availability." }
};

function AvailabilityCard({ online, setOnline }) {
  return (
    <Card className={cn("overflow-hidden p-5", online && "border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[linear-gradient(135deg,var(--surface),var(--accent-soft))]")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-[18px] text-white", online ? "bg-success" : "bg-gray-500")}><Bike className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{online ? "You’re online" : "You’re offline"}</h2><StatusBadge status={online ? "Online" : "Offline"} /></div>
          <p className="mt-1 text-sm text-secondary">{online ? "Receiving offers in Borrowdale, Highlands, and Mount Pleasant." : "Go online when you’re ready to receive delivery offers."}</p>
        </div>
        <Button variant={online ? "outline" : "primary"} onClick={() => setOnline(!online)}>{online ? <><X className="h-4 w-4" />Go offline</> : <><Play className="h-4 w-4" />Go online</>}</Button>
      </div>
    </Card>
  );
}

function JobOfferCard({ job, onAccept, onDecline, compact = false }) {
  return (
    <motion.article whileHover={{ y: -2 }} className={cn("surface rounded-2xl shadow-card", job.priority && "border-[var(--accent)]")}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><PackageCheck className="h-5 w-5" /></span><div><div className="flex items-center gap-2"><h3 className="font-semibold">{job.merchant}</h3>{job.priority && <Badge tone="accent">Priority</Badge>}</div><p className="mt-1 text-sm text-secondary">{job.type} · {job.id}</p></div></div>
          <div className="text-right"><p className="text-xl font-bold">{formatCurrency(job.pay + job.tip)}</p>{job.tip > 0 && <p className="mt-1 text-xs text-success">Includes {formatCurrency(job.tip)} tip</p>}</div>
        </div>
        <div className={cn("mt-5 grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-[1fr_auto_1fr]")}>
          <div className="rounded-2xl bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Pickup</p><p className="mt-2 text-sm font-semibold">{job.pickup}</p></div>
          {!compact && <div className="hidden items-center sm:flex"><ChevronRight className="h-5 w-5 text-tertiary" /></div>}
          <div className="rounded-2xl bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Drop-off</p><p className="mt-2 text-sm font-semibold">{job.dropoff}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-secondary"><span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5" />{job.distance}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{job.duration}</span><span className="ml-auto font-semibold text-warning">Offer expires in {job.expires}s</span></div>
      </div>
      <div className="flex gap-2 border-t p-3"><Button size="sm" variant="outline" className="flex-1" onClick={() => onDecline(job.id)}>Decline</Button><Button size="sm" className="flex-[1.5]" onClick={() => onAccept(job)}>Accept job</Button></div>
    </motion.article>
  );
}

function DriverHome({ online, setOnline, jobs, acceptJob, declineJob, navigateActive }) {
  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Monday · 20 July" title="Good evening, Tendai" description="Demand is high across north Harare. You’re two completed jobs away from today’s bonus." actions={<Button variant="outline"><Map className="h-4 w-4" />View demand map</Button>} />
      <AvailabilityCard online={online} setOnline={setOnline} />
      <div className="metric-grid">{driverMetrics.map((metric, index) => <MetricCard key={metric.label} {...metric} tone={index === 0 || index === 3 ? "success" : "default"} />)}</div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <SectionCard title="Best offer nearby" description="Matched to your current location and vehicle" action={<Link href="/driver/jobs" className="text-sm font-semibold text-[var(--accent)]">All offers</Link>}>
          <div className="p-4">{online && jobs.length ? <JobOfferCard job={jobs[0]} onAccept={acceptJob} onDecline={declineJob} /> : <EmptyState icon={online ? LocateFixed : Bike} title={online ? "Looking for nearby jobs" : "Go online for offers"} description={online ? "New offers will appear here when dispatch finds a strong match." : "You must be online to receive available delivery work."} />}</div>
        </SectionCard>
        <SectionCard title="Today’s goal" description="Complete 9 jobs to unlock US$12"><div className="p-5"><div className="flex items-end justify-between"><div><p className="text-4xl font-bold">7<span className="text-xl text-tertiary">/9</span></p><p className="mt-1 text-sm text-secondary">jobs completed</p></div><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><BadgeDollarSign className="h-6 w-6" /></span></div><ProgressBar value={78} className="mt-5 h-3" /><div className="mt-5 rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm font-semibold">US$38.40 earned today</p><p className="mt-1 text-sm text-secondary">US$12 bonus unlocks after two more jobs.</p></div></div></SectionCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><SectionCard title="Earnings trend" description="Last 12 shifts"><div className="p-5"><div className="flex items-end gap-2"><p className="text-3xl font-bold">US$286.70</p><p className="pb-1 text-sm text-success">+14.8%</p></div><Sparkline values={earningsSeries} className="mt-5 h-32" /></div></SectionCard><SectionCard title="Active delivery" description="Sakura Sushi → Highlands"><div className="p-5"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white"><Navigation className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">Heading to customer</p><p className="mt-1 text-sm text-secondary">6.2 km · approximately 17 min</p></div></div><Button className="mt-5 w-full" onClick={navigateActive}>Open active job</Button></div></SectionCard></div>
    </div>
  );
}

function Jobs({ jobs, acceptJob, declineJob }) {
  const [tab, setTab] = useState("available");
  const [query, setQuery] = useState("");
  const filtered = jobs.filter((job) => `${job.merchant} ${job.pickup} ${job.dropoff} ${job.type}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.jobs} actions={<Button variant="outline"><Map className="h-4 w-4" />Demand map</Button>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: "available", label: `Available (${jobs.length})` }, { value: "scheduled", label: "Scheduled" }]} />{tab === "available" ? <><SearchField value={query} onChange={setQuery} placeholder="Search pickup, drop-off, or merchant" />{filtered.length ? <div className="grid gap-4 xl:grid-cols-2">{filtered.map((job) => <JobOfferCard key={job.id} job={job} onAccept={acceptJob} onDecline={declineJob} />)}</div> : <Card><EmptyState icon={Search} title="No matching jobs" description="Clear your search to see all current offers." /></Card>}</> : <Card><EmptyState icon={CalendarDays} title="No scheduled jobs" description="Reserved or pre-booked deliveries will appear here." /></Card>}</div>;
}

function ActiveJob({ job, stage, progressStage }) {
  const { toast } = useToast();
  const stages = [
    { title: "Accepted", detail: "Job accepted at 18:42" },
    { title: "At pickup", detail: `Collect order and confirm code ${job.orderCode}` },
    { title: "Heading to customer", detail: `${job.distance} · approximately 17 min` },
    { title: "Delivered", detail: "Confirm customer PIN and complete job" }
  ];
  const nextLabels = ["I’m at pickup", "Start delivery", "Arrived at customer", "Complete job"];
  return <div className="space-y-6"><PageHeader {...sectionMeta.active} actions={<Badge tone="info">{job.id}</Badge>} /><div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><div className="space-y-5"><Card className="overflow-hidden"><div className="relative flex min-h-[300px] items-center justify-center bg-[linear-gradient(135deg,#dbeafe,#eff6ff)] dark:bg-[linear-gradient(135deg,#172b4d,#111f37)]"><div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #60a5fa 0 3px, transparent 4px), radial-gradient(circle at 75% 60%, #2563eb 0 4px, transparent 5px), linear-gradient(35deg, transparent 47%, #93c5fd 48% 51%, transparent 52%)", backgroundSize: "100% 100%" }} /><div className="relative rounded-2xl bg-white/90 p-4 text-center text-gray-900 shadow-elevated"><Navigation className="mx-auto h-7 w-7 text-driver" /><p className="mt-2 text-sm font-semibold">Live route preview</p><p className="mt-1 text-xs text-gray-500">{job.pickup} → {job.dropoff}</p></div></div><div className="grid gap-3 border-t p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Pickup</p><p className="mt-2 font-semibold">{job.merchant}</p><p className="mt-1 text-sm text-secondary">{job.pickup}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Customer</p><p className="mt-2 font-semibold">{job.customer}</p><p className="mt-1 text-sm text-secondary">{job.dropoff}</p></div></div></Card><SectionCard title="Delivery progress"><div className="p-5">{stages.map((item, index) => <div key={item.title} className="relative flex gap-4 pb-7 last:pb-0"><div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--surface)]" style={{ borderColor: index <= stage ? "var(--accent)" : "var(--border)", color: index <= stage ? "var(--accent)" : "var(--text-3)" }}>{index < stage ? <Check className="h-4 w-4" /> : index + 1}</div>{index < stages.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5" style={{ backgroundColor: index < stage ? "var(--accent)" : "var(--border)" }} />}<div className="pt-1"><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-secondary">{item.detail}</p></div></div>)}</div></SectionCard></div><div className="space-y-5"><Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-secondary">Estimated earnings</p><p className="mt-2 text-3xl font-bold">{formatCurrency(job.pay + job.tip)}</p></div><StatusBadge status={stage >= 3 ? "Completed" : "Active job"} /></div><div className="mt-5 rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-sm font-semibold">Order code</p><p className="mt-2 text-3xl font-bold tracking-[0.18em]">{job.orderCode}</p></div>{stage < 4 && <Button className="mt-5 w-full" onClick={() => { progressStage(); toast(stage === 3 ? "Delivery completed and earnings added." : `Job moved to ${stages[Math.min(stage + 1, 3)].title}.`); }}>{nextLabels[Math.min(stage, 3)]}</Button>}<Button className="mt-2 w-full" variant="outline"><Navigation className="h-4 w-4" />Open navigation</Button></Card><SectionCard title="Contact"><div><ListRow icon={Phone} title={job.merchant} subtitle="Call pickup location" /><div className="mx-4 border-t" /><ListRow icon={MessageCircle} title={job.customer} subtitle="Message customer safely" /></div></SectionCard><Card className="border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">Safety comes first</p><p className="mt-1 text-sm leading-6 opacity-80">Do not use the app while moving. Stop safely before updating the delivery.</p></div></div></Card></div></div></div>;
}

function Earnings() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.earnings} actions={<Button variant="outline"><FileText className="h-4 w-4" />Statement</Button>} /><div className="metric-grid"><MetricCard label="This week" value="US$131.90" delta="+14.8%" hint="vs last week" tone="success" icon={BadgeDollarSign} /><MetricCard label="Tips" value="US$18.60" delta="14.1%" hint="of total pay" icon={Star} /><MetricCard label="Bonuses" value="US$24.00" delta="2 earned" hint="this week" icon={CheckCircle2} /><MetricCard label="Next payout" value="US$86.40" delta="Friday" hint="EcoCash ••3012" icon={WalletCards} /></div><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><SectionCard title="Daily earnings" description="Current week"><div className="p-5"><BarChart data={weeklyEarnings} height={250} formatValue={(value) => formatCurrency(value)} /></div></SectionCard><SectionCard title="Pay breakdown" description="This week"><div className="p-5"><div className="space-y-4">{[{ label: "Base pay", value: 89.3, pct: 68 }, { label: "Tips", value: 18.6, pct: 14 }, { label: "Bonuses", value: 24, pct: 18 }].map((item) => <div key={item.label}><div className="flex justify-between text-sm"><span className="text-secondary">{item.label}</span><span className="font-semibold">{formatCurrency(item.value)}</span></div><ProgressBar value={item.pct} className="mt-2" /></div>)}</div><div className="mt-6 border-t pt-4"><div className="flex justify-between"><span className="font-semibold">Total</span><span className="text-xl font-bold">US$131.90</span></div></div></div></SectionCard></div><SectionCard title="Recent payouts"><div>{[{ id: "PAY-1831", date: "17 Jul", amount: 86.4, status: "Paid" }, { id: "PAY-1818", date: "10 Jul", amount: 104.2, status: "Paid" }, { id: "PAY-1807", date: "3 Jul", amount: 92.8, status: "Paid" }].map((item) => <div key={item.id} className="flex min-h-[64px] items-center gap-3 border-b px-5 py-3 last:border-b-0"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><WalletCards className="h-5 w-5" /></span><div className="flex-1"><p className="text-sm font-semibold">{item.id}</p><p className="mt-1 text-xs text-secondary">{item.date} · EcoCash ••3012</p></div><p className="font-semibold">{formatCurrency(item.amount)}</p><StatusBadge status={item.status} /></div>)}</div></SectionCard></div>;
}

function HistoryView() {
  const [query, setQuery] = useState("");
  const visible = jobHistory.filter((item) => `${item.id} ${item.merchant} ${item.route}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.history} /><SearchField value={query} onChange={setQuery} placeholder="Search jobs" /><SectionCard><div>{visible.map((item) => <div key={item.id} className="flex min-h-[70px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><History className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.merchant}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-sm text-secondary">{item.route}</p><p className="mt-1 text-xs text-tertiary">{item.id} · {item.date}</p></div><p className="font-semibold">{formatCurrency(item.pay)}</p><ChevronRight className="h-4 w-4 text-tertiary" /></div>)}</div></SectionCard></div>;
}

function Support() {
  const { toast } = useToast();
  return <div className="space-y-6"><PageHeader {...sectionMeta.support} /><Card className="border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger text-white"><ShieldCheck className="h-6 w-6" /></span><div className="flex-1"><h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Emergency safety support</h2><p className="mt-1 text-sm text-red-700 dark:text-red-300">Use this only for immediate danger or an urgent active-job safety issue.</p></div><Button variant="danger" onClick={() => toast("Safety support request opened.", { type: "error", title: "Emergency support" })}><Phone className="h-4 w-4" />Contact safety</Button></div></Card><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Get help"><div><ListRow icon={Headphones} title="Live driver support" subtitle="Chat with the operations team" /><div className="mx-4 border-t" /><ListRow icon={CircleHelp} title="Help centre" subtitle="Jobs, payments, account, and vehicle" /><div className="mx-4 border-t" /><ListRow icon={MessageCircle} title="Report an issue" subtitle="Tell us about a completed job" /></div></SectionCard><SectionCard title="Safety resources"><div><ListRow icon={ShieldCheck} title="Safety toolkit" subtitle="Emergency contacts and safe delivery guidance" /><div className="mx-4 border-t" /><ListRow icon={AlertTriangle} title="Incident history" subtitle="Review submitted safety reports" /><div className="mx-4 border-t" /><ListRow icon={FileText} title="Driver policies" subtitle="Terms, privacy, and community standards" /></div></SectionCard></div></div>;
}

function Profile() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.profile} actions={<Button variant="outline">Edit profile</Button>} /><Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center"><span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--accent)] text-xl font-bold text-white">TM</span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Tendai Mutendi</h2><Badge tone="success">Verified</Badge></div><p className="mt-1 text-sm text-secondary">Harare · Motorbike · Joined March 2026</p><div className="mt-3 flex flex-wrap gap-2"><Badge tone="accent">4.96 rating</Badge><Badge tone="neutral">1,842 jobs</Badge><Badge tone="neutral">Top 8%</Badge></div></div></Card><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Driver account"><div><ListRow icon={UserRound} title="Personal details" subtitle="Name, phone, and emergency contact" /><div className="mx-4 border-t" /><ListRow icon={Bike} title="Vehicle details" subtitle="Honda CB125 · ACD 4812" /><div className="mx-4 border-t" /><ListRow icon={IdCard} title="Documents" subtitle="Licence, registration, and insurance" trailing={<StatusBadge status="Approved" />} /><div className="mx-4 border-t" /><ListRow icon={WalletCards} title="Payout method" subtitle="EcoCash ••3012" /></div></SectionCard><SectionCard title="Preferences"><div><ListRow icon={MapPin} title="Delivery zones" subtitle="Borrowdale, Highlands, Mount Pleasant" /><div className="mx-4 border-t" /><ListRow icon={CalendarDays} title="Availability" subtitle="Flexible schedule" /><div className="mx-4 border-t" /><ListRow icon={BellRing} title="Notifications" subtitle="Offers, payouts, and safety updates" /><div className="mx-4 border-t" /><ListRow icon={LockKeyhole} title="Privacy & security" subtitle="Password and account access" /></div></SectionCard></div><SectionCard title="Verification progress" description="All required steps are complete"><div className="grid gap-3 p-5 sm:grid-cols-3">{["Identity", "Vehicle", "Background check"].map((item) => <div key={item} className="rounded-2xl bg-green-50 p-4 text-green-800 dark:bg-green-950/30 dark:text-green-300"><CheckCircle2 className="h-5 w-5" /><p className="mt-3 text-sm font-semibold">{item}</p><p className="mt-1 text-xs opacity-75">Approved</p></div>)}</div></SectionCard></div>;
}

export function DriverApp({ section = "home" }) {
  const safeSection = sectionMeta[section] ? section : "home";
  const [online, setOnline] = useState(true);
  const [jobs, setJobs] = useState(initialJobOffers);
  const [activeJob, setActiveJob] = useState(activeJobSeed);
  const [stage, setStage] = useState(2);
  const [offerModal, setOfferModal] = useState(null);
  const { toast } = useToast();

  function acceptJob(job) {
    setActiveJob({ ...activeJobSeed, id: job.id, merchant: job.merchant, pickup: job.pickup, dropoff: job.dropoff, pay: job.pay, tip: job.tip, distance: job.distance });
    setStage(0);
    setJobs((current) => current.filter((item) => item.id !== job.id));
    setOfferModal(null);
    toast(`${job.id} accepted. Navigate to ${job.merchant}.`, { title: "Job accepted" });
    window.location.href = "/driver/active";
  }

  function declineJob(id) {
    setJobs((current) => current.filter((item) => item.id !== id));
    toast(`${id} removed from your offers.`, { title: "Offer declined", type: "info" });
  }

  function progressStage() {
    setStage((current) => Math.min(4, current + 1));
  }

  return <PortalShell portalId="driver" activeSection={safeSection}><div className="mx-auto max-w-[1450px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
    {safeSection === "home" && <DriverHome online={online} setOnline={setOnline} jobs={jobs} acceptJob={acceptJob} declineJob={declineJob} navigateActive={() => { window.location.href = "/driver/active"; }} />}
    {safeSection === "jobs" && <Jobs jobs={jobs} acceptJob={(job) => setOfferModal(job)} declineJob={declineJob} />}
    {safeSection === "active" && <ActiveJob job={activeJob} stage={stage} progressStage={progressStage} />}
    {safeSection === "earnings" && <Earnings />}
    {safeSection === "history" && <HistoryView />}
    {safeSection === "support" && <Support />}
    {safeSection === "profile" && <Profile />}
  </div><Modal open={Boolean(offerModal)} onClose={() => setOfferModal(null)} title="Confirm job acceptance" size="sm">{offerModal && <div className="p-5"><JobOfferCard job={offerModal} onAccept={acceptJob} onDecline={declineJob} compact /><p className="mt-4 text-xs leading-5 text-secondary">Accepting confirms that you can travel to the pickup now and complete the delivery safely.</p></div>}</Modal></PortalShell>;
}
