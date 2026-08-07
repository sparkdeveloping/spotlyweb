"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  IdCard,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Play,
  ShieldCheck,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { AuthGate } from "@/components/auth-gate";
import { BarChart } from "@/components/charts";
import { Badge, Button, Card, EmptyState, ListRow, Modal, PageHeader, ProgressBar, SearchField, SectionCard, StatusBadge } from "@/components/ui";
import { useAuth } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { activeJob as activeJobSeed, jobHistory, jobOffers as initialJobOffers, weeklyEarnings } from "@/data/driver";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { readState, writeState, removeState } from "@/lib/browser-state";
import { workspaceAccess } from "@/lib/workspaces";

const STORE_KEY = "driver-training-workflow";
const stages = [
  { id: "to_pickup", label: "Going to pickup", action: "I have arrived", helper: "Navigate to the business and confirm when you arrive." },
  { id: "at_pickup", label: "At pickup", action: "Order collected", helper: "Confirm the pickup code and check the order before leaving." },
  { id: "to_customer", label: "Going to customer", action: "I have arrived", helper: "Use navigation and avoid interacting with the app while moving." },
  { id: "handoff", label: "Customer handoff", action: "Complete delivery", helper: "Confirm the customer PIN or approved proof of delivery." },
  { id: "complete", label: "Completed", action: "Back to jobs", helper: "The job has been completed and added to earnings." }
];

const sectionMeta = {
  home: { title: "Driver home", description: "Your current shift and the next safe action." },
  jobs: { title: "Available jobs", description: "Review one offer at a time and accept only when you can travel safely." },
  active: { title: "Active job", description: "Complete the current delivery one step at a time." },
  earnings: { title: "Earnings", description: "Pay, tips and payout history." },
  history: { title: "Job history", description: "Completed work and recorded outcomes." },
  support: { title: "Safety and support", description: "Get help or record an issue." },
  profile: { title: "Driver profile", description: "Your account, vehicle and verification information." }
};

function seededState(scenario = "standard") {
  const jobs = scenario === "priority" ? [...initialJobOffers].sort((a, b) => Number(Boolean(b.priority)) - Number(Boolean(a.priority))) : initialJobOffers;
  return { scenario, online: false, jobs, activeJob: null, stage: 0, completed: [], pickupCode: "", handoffPin: "" };
}

function useDriverWorkflow(user) {
  const [state, setState] = useState(seededState);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = readState(STORE_KEY, user, null, "session");
    if (saved) setState({ ...seededState(saved.scenario), ...saved });
    setReady(true);
  }, [user?.uid]);
  useEffect(() => { if (ready) writeState(STORE_KEY, user, state, "session"); }, [ready, state, user?.uid]);
  const reset = (scenario = "standard") => {
    removeState(STORE_KEY, user, "session");
    setState(seededState(scenario));
  };
  return [state, setState, ready, reset];
}

function DemoNotice() {
  return <div className="rounded-lg border border-[color-mix(in_srgb,var(--info)_35%,var(--border))] bg-[var(--info-soft)] px-4 py-3 text-sm leading-6 text-[var(--on-info-soft)]"><strong>Training only:</strong> These fictional jobs are not connected to dispatch, customers, payouts or live location services.</div>;
}

function Availability({ online, setOnline, hasActiveJob }) {
  return <Card className={cn("p-5", online && "border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]")}><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className={cn("flex h-14 w-14 items-center justify-center rounded-xl", online ? "bg-[var(--success)] text-[var(--on-success)]" : "bg-[var(--surface-2)] text-[var(--text-2)]")}><Bike className="h-6 w-6" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{online ? "You are online" : "You are offline"}</h2><StatusBadge status={online ? "Online" : "Offline"} /></div><p className="mt-1 text-sm text-secondary">{online ? hasActiveJob ? "Finish the active job before accepting another offer." : "You can receive offers in your selected areas." : "Go online when you are ready to receive an offer."}</p></div><Button variant={online ? "outline" : "primary"} onClick={() => setOnline(!online)}>{online ? <><X className="h-4 w-4" />Go offline</> : <><Play className="h-4 w-4" />Go online</>}</Button></div></Card>;
}

function JobOffer({ job, onAccept, onDecline }) {
  return <Card className={cn("overflow-hidden", job.priority && "border-[var(--accent)]")}><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><PackageCheck className="h-5 w-5" /></span><div><div className="flex items-center gap-2"><h3 className="font-semibold">{job.merchant}</h3>{job.priority && <Badge tone="accent">Priority</Badge>}</div><p className="mt-1 text-sm text-secondary">{job.type} · {job.id}</p></div></div><div className="text-right"><p className="text-xl font-semibold">{formatCurrency(job.pay + job.tip)}</p>{job.tip > 0 && <p className="mt-1 text-xs text-success">Includes {formatCurrency(job.tip)} tip</p>}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">PICKUP</p><p className="mt-2 text-sm font-semibold">{job.pickup}</p></div><div className="hidden items-center sm:flex"><ChevronRight className="h-5 w-5 text-tertiary" /></div><div className="rounded-lg bg-[var(--surface-2)] p-3"><p className="text-xs font-semibold text-tertiary">DROP-OFF AREA</p><p className="mt-2 text-sm font-semibold">{job.dropoff}</p></div></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-secondary"><span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5" />{job.distance}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{job.duration}</span></div></div><div className="flex gap-2 border-t p-3"><Button size="sm" variant="outline" className="flex-1" onClick={() => onDecline(job.id)}>Decline</Button><Button size="sm" className="flex-[1.5]" onClick={() => onAccept(job)}>Accept job</Button></div></Card>;
}

function DriverHome({ state, setState, onAccept }) {
  const { profile, user } = useAuth();
  const name = (profile?.displayName || user?.displayName || "Driver").split(" ")[0];
  const router = useRouter();
  return <div className="space-y-6"><PageHeader eyebrow={new Date().toLocaleDateString("en-ZW", { weekday: "long", day: "numeric", month: "long" })} title={`Hello, ${name}`} description={state.activeJob ? "You have an active job. Continue from the exact step where you stopped." : "Go online when you are ready to receive work."} actions={state.activeJob ? <Button onClick={() => router.push("/driver/active")}>Continue active job</Button> : undefined} /><DemoNotice /><Availability online={state.online} hasActiveJob={Boolean(state.activeJob)} setOnline={(online) => setState((current) => ({ ...current, online }))} />{state.activeJob ? <Card className="p-5"><div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Navigation className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--accent)]">Current task</p><h2 className="mt-1 text-xl font-semibold">{stages[state.stage]?.label}</h2><p className="mt-2 text-sm text-secondary">{state.activeJob.merchant} · {state.activeJob.id}</p></div><Button onClick={() => router.push("/driver/active")}>Open</Button></div></Card> : state.online && state.jobs.length ? <div><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Best offer nearby</p><h2 className="mt-1 text-2xl font-semibold">Review before accepting</h2></div><Link href="/driver/jobs" className="text-sm font-semibold text-[var(--accent)]">All offers</Link></div><JobOffer job={state.jobs[0]} onAccept={onAccept} onDecline={(id) => setState((current) => ({ ...current, jobs: current.jobs.filter((job) => job.id !== id) }))} /></div> : <EmptyState icon={state.online ? PackageCheck : Bike} title={state.online ? "No offers right now" : "You are not receiving offers"} description={state.online ? "Keep this screen open or go offline while you wait." : "Go online only when you are ready to travel safely."} />}</div>;
}

function Jobs({ state, setState, onAccept }) {
  return <div className="space-y-6"><PageHeader {...sectionMeta.jobs} /><DemoNotice />{!state.online ? <EmptyState icon={Bike} title="Go online to review offers" description="Offers are hidden while you are offline." action={<Button onClick={() => setState((current) => ({ ...current, online: true }))}>Go online</Button>} /> : state.activeJob ? <EmptyState icon={Navigation} title="Finish your active job first" description="A driver can complete one job safely before accepting another." action={<Button asChild><Link href="/driver/active">Continue active job</Link></Button>} /> : state.jobs.length ? <div className="grid gap-4 xl:grid-cols-2">{state.jobs.map((job) => <JobOffer key={job.id} job={job} onAccept={onAccept} onDecline={(id) => setState((current) => ({ ...current, jobs: current.jobs.filter((item) => item.id !== id) }))} />)}</div> : <EmptyState icon={PackageCheck} title="No offers available" description="New offers will appear here while you remain online." />}</div>;
}

function MapsButton({ destination, children = "Open navigation" }) {
  const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination || "Harare, Zimbabwe")}`;
  return <Button asChild className="w-full"><a href={href} target="_blank" rel="noreferrer"><Navigation className="h-5 w-5" />{children}</a></Button>;
}

function ActiveJob({ state, setState }) {
  const router = useRouter();
  const { toast } = useToast();
  const job = state.activeJob;
  if (!job) return <div className="space-y-6"><PageHeader {...sectionMeta.active} /><EmptyState icon={Navigation} title="No active job" description="Accept an available offer when you are online." action={<Button asChild><Link href="/driver/jobs">View offers</Link></Button>} /></div>;
  const stage = stages[state.stage] || stages[0];
  const destination = state.stage < 2 ? job.pickup : job.dropoff;
  function progress() {
    if (state.stage === 1 && state.pickupCode.trim() !== String(job.orderCode || "8241")) {
      toast("Enter the training pickup code shown for this scenario.", { type: "error", title: "Pickup code required" });
      return;
    }
    if (state.stage === 3 && state.handoffPin.trim() !== "2468") {
      toast("Enter the training customer PIN 2468 to complete the handoff.", { type: "error", title: "Customer PIN required" });
      return;
    }
    if (state.stage < 4) {
      const next = state.stage + 1;
      setState((current) => ({ ...current, stage: next }));
      toast(next === 4 ? "Training delivery completed." : `Moved to ${stages[next].label}.`, { title: next === 4 ? "Scenario complete" : "Training updated" });
    } else {
      setState((current) => ({ ...current, activeJob: null, stage: 0, completed: [{ ...job, completedAt: new Date().toISOString() }, ...current.completed] }));
      router.push("/driver/jobs");
    }
  }
  return <div className="mx-auto max-w-2xl space-y-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--accent)]">{job.id}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">{stage.label}</h1></div><StatusBadge status={state.stage === 4 ? "Completed" : "Active job"} /></div><div className="rounded-xl bg-[var(--inverse-surface)] p-5 text-[var(--inverse-text)]"><p className="text-xs font-semibold text-[color-mix(in_srgb,var(--inverse-text)_55%,transparent)]">CURRENT DESTINATION</p><h2 className="mt-3 text-2xl font-semibold">{destination}</h2><p className="mt-2 text-sm text-[color-mix(in_srgb,var(--inverse-text)_65%,transparent)]">{stage.helper}</p><div className="mt-6">{state.stage < 4 ? <MapsButton destination={destination} /> : <div className="rounded-lg bg-[var(--surface)]/10 p-4 text-sm">This job is complete. Review the earnings, then return to available work.</div>}</div></div><Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-tertiary">PICKUP</p><p className="mt-2 font-semibold">{job.merchant}</p><p className="mt-1 text-sm text-secondary">{job.pickup}</p></div><div className="text-right"><p className="text-xs font-semibold text-tertiary">PAY</p><p className="mt-2 text-lg font-semibold">{formatCurrency((job.pay || 0) + (job.tip || 0))}</p></div></div>{state.stage === 1 && <div className="mt-5 rounded-lg bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><p className="font-semibold">Training pickup code: {job.orderCode || "8241"}</p><p className="mt-1">Enter the displayed code to practise the collection check.</p><input aria-label="Training pickup code" value={state.pickupCode || ""} onChange={(event) => setState((current) => ({ ...current, pickupCode: event.target.value }))} className="mt-3 h-11 w-full rounded-lg border border-[color-mix(in_srgb,var(--warning)_45%,var(--border))] bg-[var(--surface)] px-3 text-[var(--text)]" inputMode="numeric" /></div>}{state.stage === 3 && <div className="mt-5 rounded-lg bg-[var(--accent-soft)] p-4 text-sm text-[var(--on-accent-soft)]"><p className="font-semibold">Training customer PIN: 2468</p><p className="mt-1">Enter the displayed PIN to practise a verified handoff.</p><input aria-label="Training customer PIN" value={state.handoffPin || ""} onChange={(event) => setState((current) => ({ ...current, handoffPin: event.target.value }))} className="mt-3 h-11 w-full rounded-lg border bg-[var(--surface)] px-3 text-[var(--text)]" inputMode="numeric" /></div>}</Card><div className="grid grid-cols-2 gap-3"><Button asChild variant="outline"><Link href={`/support?topic=driver-job&reference=${encodeURIComponent(job.id)}`}><MessageCircle className="h-4 w-4" />Report a problem</Link></Button><Button onClick={progress}>{state.stage === 4 ? <><CheckCircle2 className="h-4 w-4" />Finish</> : <><Check className="h-4 w-4" />{stage.action}</>}</Button></div><div className="flex items-center justify-between gap-2">{stages.map((item, index) => <div key={item.id} className="min-w-0 flex-1"><div className={cn("h-1.5 rounded-full", index <= state.stage ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]")} /><p className="mt-2 hidden truncate text-center text-[10px] text-secondary sm:block">{item.label}</p></div>)}</div></div>;
}

function Earnings() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.earnings} /><DemoNotice /><div className="grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-secondary">Scenario total</p><p className="mt-3 text-3xl font-semibold">US$131.90</p></Card><Card className="p-5"><p className="text-sm text-secondary">Tips</p><p className="mt-3 text-3xl font-semibold">US$18.60</p></Card><Card className="p-5"><p className="text-sm text-secondary">Training payout</p><p className="mt-3 text-3xl font-semibold">Not scheduled</p></Card></div><SectionCard title="Daily earnings" description="Training data for the current week"><div className="p-5"><BarChart data={weeklyEarnings} height={250} formatValue={(value) => formatCurrency(value)} /></div></SectionCard><SectionCard title="Pay breakdown"><div className="space-y-4 p-5">{[{ label: "Base pay", value: 89.3, pct: 68 }, { label: "Tips", value: 18.6, pct: 14 }, { label: "Bonuses", value: 24, pct: 18 }].map((item) => <div key={item.label}><div className="flex justify-between text-sm"><span className="text-secondary">{item.label}</span><span className="font-semibold">{formatCurrency(item.value)}</span></div><ProgressBar value={item.pct} className="mt-2" label={`${item.label} share`} /></div>)}</div></SectionCard></div>;
}

function HistoryView({ completed }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => [...completed.map((job) => ({ id: job.id, merchant: job.merchant, route: `${job.pickup} → ${job.dropoff}`, date: new Date(job.completedAt).toLocaleString("en-ZW"), pay: (job.pay || 0) + (job.tip || 0), status: "Completed" })), ...jobHistory.filter((item) => item.status !== "Active")], [completed]);
  const visible = rows.filter((item) => `${item.id} ${item.merchant} ${item.route}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-6"><PageHeader {...sectionMeta.history} /><DemoNotice /><SearchField value={query} onChange={setQuery} label="Search job history" placeholder="Search jobs" /><SectionCard><div>{visible.map((item) => <div key={`${item.id}-${item.date}`} className="flex min-h-[70px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><History className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.merchant}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-sm text-secondary">{item.route}</p><p className="mt-1 text-xs text-tertiary">{item.id} · {item.date}</p></div><p className="font-semibold">{formatCurrency(item.pay)}</p></div>)}</div></SectionCard></div>;
}

function Support() {
  return <div className="space-y-6"><PageHeader {...sectionMeta.support} /><Card className="border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger text-[var(--on-danger)]"><ShieldCheck className="h-6 w-6" /></span><div className="flex-1"><h2 className="text-lg font-semibold text-[var(--on-danger-soft)]">Immediate danger</h2><p className="mt-1 text-sm text-[var(--on-danger-soft)]">Move to a safe place and contact local emergency services. Use Spotly support for an active-job incident or follow-up.</p></div><Button asChild variant="danger"><Link href="/support?topic=safety"><Phone className="h-4 w-4" />Open urgent support</Link></Button></div></Card><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Get help"><div><ListRow href="/support?topic=driver-job" icon={MessageCircle} title="Active-job support" subtitle="Include the job reference and what happened" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-account" icon={UserRound} title="Account or vehicle help" subtitle="Profile, documents, payout or availability" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-payment" icon={WalletCards} title="Earnings and payout help" subtitle="Ask about a statement or payout" /></div></SectionCard><SectionCard title="Safety resources"><div><ListRow href="/support?topic=safety-guidance" icon={ShieldCheck} title="Safety guidance" subtitle="Safe pickup, contact and handoff practices" /><div className="mx-4 border-t" /><ListRow href="/support?topic=incident" icon={AlertTriangle} title="Report an incident" subtitle="Create a record for review" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-policy" icon={IdCard} title="Driver policies" subtitle="Request the current operating guidance" /></div></SectionCard></div></div>;
}

function Profile() {
  const { profile, user } = useAuth();
  const name = profile?.displayName || user?.displayName || "Driver";
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <div className="space-y-6"><PageHeader {...sectionMeta.profile} actions={<Button asChild variant="outline"><Link href="/account">Open account settings</Link></Button>} /><DemoNotice /><Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center"><span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--accent)] text-xl font-semibold text-[var(--on-accent)]">{initials}</span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{name}</h2><Badge tone="warning">Training profile</Badge></div><p className="mt-1 text-sm text-secondary">Live driver verification details will appear after onboarding.</p></div></Card><div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Driver account"><div><ListRow href="/account" icon={UserRound} title="Personal details" subtitle="Name, phone and account security" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-vehicle" icon={Bike} title="Vehicle details" subtitle="Add or update a vehicle through driver support" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-documents" icon={IdCard} title="Documents" subtitle="Licence, registration and insurance" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-payout" icon={WalletCards} title="Payout method" subtitle="Update payout details securely" /></div></SectionCard><SectionCard title="Preferences"><div><ListRow href="/support?topic=driver-zones" icon={MapPin} title="Delivery zones" subtitle="Request an area change" /><div className="mx-4 border-t" /><ListRow href="/support?topic=driver-availability" icon={CalendarDays} title="Availability" subtitle="Update your normal schedule" /><div className="mx-4 border-t" /><ListRow href="/account" icon={ShieldCheck} title="Privacy and security" subtitle="Manage your Spotly account" /></div></SectionCard></div></div>;
}

export function DriverApp({ section = "home" }) {
  const safeSection = sectionMeta[section] ? section : "home";
  const { user, profile, memberships } = useAuth();
  const [state, setState, ready, resetTraining] = useDriverWorkflow(user);
  const [offerModal, setOfferModal] = useState(null);
  const router = useRouter();
  const { toast } = useToast();

  function acceptJob(job) {
    const nextJob = { ...activeJobSeed, ...job, customer: "Customer details appear after pickup", orderCode: activeJobSeed.orderCode || "8241" };
    setState((current) => ({ ...current, activeJob: nextJob, stage: 0, jobs: current.jobs.filter((item) => item.id !== job.id), online: true }));
    setOfferModal(null);
    toast(`${job.id} accepted.`, { title: "Job accepted" });
    router.push("/driver/active");
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Bike className="h-8 w-8 animate-pulse text-driver" /></div>;
  const canTrain = workspaceAccess({ profile, memberships }).has("driver") || workspaceAccess({ profile, memberships }).has("admin") || workspaceAccess({ profile, memberships }).has("staff");

  return <AuthGate portal="driver"><PortalShell portalId="driver" activeSection={safeSection}><div className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{!canTrain ? <Card variant="bordered" className="mx-auto max-w-lg p-7 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-driver" /><h1 className="mt-4 text-2xl font-semibold">Driver training access is not assigned</h1><p className="mt-3 text-sm leading-6 text-secondary">This internal training workspace is available only to approved driver, operations and administrator accounts.</p><Button asChild className="mt-6"><Link href="/account">Return to account</Link></Button></Card> : <><div className="mb-5 flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">Training scenario</p><p className="mt-1 text-sm text-secondary">No action on this page is sent to live dispatch.</p></div><select aria-label="Training scenario" value={state.scenario || "standard"} onChange={(event) => resetTraining(event.target.value)} className="h-11 rounded-lg border bg-[var(--surface)] px-3 text-sm font-semibold"><option value="standard">Standard pickup</option><option value="priority">Priority offer</option></select><Button variant="outline" onClick={() => resetTraining(state.scenario || "standard")}>Reset training</Button></div>{safeSection === "home" && <DriverHome state={state} setState={setState} onAccept={(job) => setOfferModal(job)} />}{safeSection === "jobs" && <Jobs state={state} setState={setState} onAccept={(job) => setOfferModal(job)} />}{safeSection === "active" && <ActiveJob state={state} setState={setState} />}{safeSection === "earnings" && <Earnings />}{safeSection === "history" && <HistoryView completed={state.completed || []} />}{safeSection === "support" && <Support />}{safeSection === "profile" && <Profile />}</>}</div><Modal open={Boolean(offerModal)} onClose={() => setOfferModal(null)} title="Accept this job?" description="Confirm that you can travel to the pickup now and complete the delivery safely." size="sm">{offerModal && <div className="p-5"><JobOffer job={offerModal} onAccept={acceptJob} onDecline={(id) => { setState((current) => ({ ...current, jobs: current.jobs.filter((item) => item.id !== id) })); setOfferModal(null); }} /></div>}</Modal></PortalShell></AuthGate>;
}
