"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Flag,
  Gauge,
  Handshake,
  Layers3,
  Printer,
  Rocket,
  Scale,
  Server,
  Sparkles,
  Truck,
  WalletCards,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Badge, Button, Card, ProgressBar, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import {
  clientRequirementGroups,
  decisions,
  launchGates,
  launchStages,
  productAreas,
  statusSnapshot,
  workstreams
} from "@/data/devstatus";
import { cn } from "@/lib/cn";

const sectionLinks = [
  { href: "#overview", label: "Overview" },
  { href: "#products", label: "Four apps" },
  { href: "#workstreams", label: "Workstreams" },
  { href: "#client-inputs", label: "Client inputs" },
  { href: "#launch-plan", label: "Launch plan" }
];

const reviewReady = [
  "Light-mode public coming-soon website with waitlist, partnership, business discovery, and claim entry points",
  "Firebase-connected account, business, branch, product, pickup order, claim, support, content, settings, and audit architecture",
  "Admin-controlled private beta, marketplace behavior, verification policy, currencies, payment methods, support, roles, and launch settings",
  "Secure Next.js route handlers for order totals, Paynow initiation/status/result processing, notifications, email, first-admin bootstrap, and data seeding",
  "Development and production-draft Firestore/Storage rules, composite indexes, emulator configuration, Vercel configuration, and seed scripts"
];

const notLiveYet = [
  "External Firebase Admin, Apple, phone, App Check, VAPID, Paynow, Resend, domain, and monitoring credentials are not included in the archive",
  "The production Firestore and Storage rules are drafts and must be tested against every role before replacing development test-mode rules",
  "Real business records and images remain provisional until each source, branch, owner, catalogue, price, and usage right is verified",
  "Live money movement, settlement, refunds, fiscal documents, reconciliation, and payouts require sandbox and finance-policy approval",
  "Legal entity details, privacy/terms/merchant/refund documents, official support contacts, and pilot operating procedures are still required",
  "A deployed production build, cross-browser/device QA, accessibility audit, load test, security review, backup/restore exercise, and controlled pilot are still pending"
];

function statusTone(status) {
  const value = status.toLowerCase();
  if (value.includes("complete") || value.includes("ready") || value.includes("approved")) return "success";
  if (value.includes("current") || value.includes("progress") || value.includes("review")) return "info";
  if (value.includes("critical") || value.includes("blocked")) return "danger";
  if (value.includes("required") || value.includes("needed") || value.includes("decision") || value.includes("provider") || value.includes("policy")) return "warning";
  return "neutral";
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-[15px] leading-7 text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function ReadinessMetric({ label, value, helper, icon: Icon, accent = "var(--accent)" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-secondary">{label}</p>
          <p className="mt-3 text-[34px] font-bold tracking-[-0.045em]">{value}%</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <ProgressBar value={value} color={accent} className="mt-5" />
      <p className="mt-3 text-xs leading-5 text-tertiary">{helper}</p>
    </Card>
  );
}

function ProductCard({ product, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.04 }}
      className="surface overflow-hidden rounded-[22px] shadow-card"
    >
      <div className="h-1.5" style={{ backgroundColor: product.accent }} />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Image src={product.logo} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">{product.name}</h3>
            <p className="mt-1 text-xs text-secondary">Route: {product.route}</p>
          </div>
          <Badge tone={statusTone(product.status)} dot>{product.status}</Badge>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="font-medium text-secondary">Experience completion</span>
          <span className="font-bold">{product.progress}%</span>
        </div>
        <ProgressBar value={product.progress} color={product.accent} className="mt-2.5" />
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-success">Available now</p>
            <ul className="mt-3 space-y-2">
              {product.complete.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warning">Still required</p>
            <ul className="mt-3 space-y-2">
              {product.next.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-5 text-secondary">
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link href={product.route} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3.5 text-sm font-semibold transition hover:brightness-[0.97]">
          Open app <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </motion.article>
  );
}

function WorkstreamTable({ filter }) {
  const groups = useMemo(() => {
    if (filter === "all") return workstreams;
    return workstreams
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const status = item.status.toLowerCase();
          if (filter === "complete") return status.includes("complete") || status.includes("ready");
          if (filter === "active") return status.includes("progress") || status.includes("review");
          return !(status.includes("complete") || status.includes("ready") || status.includes("progress") || status.includes("review"));
        })
      }))
      .filter((group) => group.items.length);
  }, [filter]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.group} className="overflow-hidden">
          <div className="border-b bg-[var(--surface-2)]/55 px-4 py-3 sm:px-5">
            <h3 className="font-semibold">{group.group}</h3>
          </div>
          <div className="divide-y">
            {group.items.map((item) => (
              <div key={item.name} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_150px_170px] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <div className="mt-2 flex items-center gap-3 sm:hidden">
                    <ProgressBar value={item.progress} className="flex-1" />
                    <span className="text-xs font-semibold text-secondary">{item.progress}%</span>
                  </div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <ProgressBar value={item.progress} className="flex-1" />
                  <span className="w-8 text-right text-xs font-semibold text-secondary">{item.progress}%</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <span className="text-xs text-tertiary sm:hidden">{item.owner}</span>
                  <div className="text-right">
                    <Badge tone={statusTone(item.status)} dot>{item.status}</Badge>
                    <p className="mt-1.5 hidden text-[11px] text-tertiary sm:block">{item.owner}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function RequirementAccordion({ group, open, onToggle }) {
  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-start gap-4 p-4 text-left sm:p-5" aria-expanded={open}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {group.id === "commercial" ? <WalletCards className="h-5 w-5" /> : group.id === "supply" ? <Handshake className="h-5 w-5" /> : group.id === "driver-ops" ? <Truck className="h-5 w-5" /> : group.id === "legal" ? <Scale className="h-5 w-5" /> : group.id === "technology" ? <Server className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{group.title}</span>
            <Badge tone={group.priority.includes("Launch") ? "danger" : group.priority.includes("Pilot") || group.priority.includes("Integration") ? "warning" : "info"}>{group.priority}</Badge>
          </span>
          <span className="mt-1.5 block text-sm leading-6 text-secondary">{group.description}</span>
          <span className="mt-2 block text-xs font-medium text-tertiary">Client owner: {group.owner}</span>
        </span>
        <ChevronDown className={cn("mt-2 h-5 w-5 shrink-0 text-tertiary transition", open && "rotate-180")} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t bg-[var(--surface-2)]/35 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {group.requirements.map((item) => (
              <div key={item} className="surface flex gap-3 rounded-2xl p-3.5 shadow-none">
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-sm leading-5 text-secondary">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </Card>
  );
}

function LaunchTimeline() {
  return (
    <div className="relative space-y-3 before:absolute before:bottom-8 before:left-[25px] before:top-8 before:w-px before:bg-[var(--border)] sm:before:left-[29px]">
      {launchStages.map((stage) => {
        const active = stage.status === "Current stage";
        const complete = stage.status === "Complete";
        return (
          <Card key={stage.number} className={cn("relative ml-0 p-4 sm:p-5", active && "border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] shadow-elevated")}>
            <div className="flex gap-4">
              <span className={cn("relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold sm:h-14 sm:w-14", complete ? "border-green-500/25 bg-green-50 text-green-700 dark:bg-green-950/35 dark:text-green-300" : active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "surface text-tertiary")}>{complete ? <Check className="h-5 w-5" /> : stage.number}</span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{stage.title}</h3>
                  <Badge tone={statusTone(stage.status)} dot>{stage.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-secondary">{stage.description}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function DevStatusApp() {
  const { toast } = useToast();
  const [workstreamFilter, setWorkstreamFilter] = useState("all");
  const [openRequirements, setOpenRequirements] = useState(["commercial", "supply"]);

  function toggleRequirement(id) {
    setOpenRequirements((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("The client-facing report URL is ready to share.", { title: "Development status link copied" });
    } catch {
      toast("Copy the /devstatus URL from your browser address bar.", { title: "Could not copy automatically", type: "info" });
    }
  }

  return (
    <PortalShell portalId="customer" activeSection="devstatus" hideSidebar>
      <div className="devstatus-page pb-16">
        <div className="devstatus-no-print sticky top-20 z-20 border-b bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] backdrop-blur-xl">
          <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
            {sectionLinks.map((item) => <a key={item.href} href={item.href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-secondary transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]">{item.label}</a>)}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
          <section id="overview" className="scroll-mt-36 overflow-hidden rounded-[30px] bg-gradient-to-br from-[#24165f] via-[#5b21b6] to-[#8b5cf6] p-5 text-white shadow-elevated sm:p-8 lg:p-10">
            <div className="relative">
              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
              <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
              <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/12 text-white ring-white/20" dot>Client development report</Badge>
                    <span className="text-xs font-medium text-white/65">Updated {statusSnapshot.updated}</span>
                  </div>
                  <h1 className="mt-5 max-w-4xl text-[38px] font-bold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-[62px]">Spotly development status and launch readiness</h1>
                  <p className="mt-5 max-w-3xl text-base leading-7 text-white/76 sm:text-lg">{statusSnapshot.summary}</p>
                  {/* <div className="devstatus-no-print mt-7 flex flex-wrap gap-2">
                    <Button onClick={() => window.print()} className="bg-white text-violet-800 hover:bg-white/90"><Printer className="h-4 w-4" />Print or save PDF</Button>
                    <Button onClick={copyLink} variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15"><Copy className="h-4 w-4" />Copy report link</Button>
                  </div> */}
                </div>
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Current phase</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-4xl font-bold tracking-[-0.05em]">Stage {statusSnapshot.stage}</p>
                      <p className="mt-1 text-sm text-white/65">of {statusSnapshot.stageCount}</p>
                    </div>
                    <Badge className="bg-white text-violet-800 ring-0">{statusSnapshot.label}</Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-6 gap-1.5">
                    {Array.from({ length: statusSnapshot.stageCount }).map((_, index) => <span key={index} className={cn("h-2 rounded-full", index < statusSnapshot.stage ? "bg-white" : "bg-white/20")} />)}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/72">The current phase is production configuration and verification: credentials, rules tests, provider sandboxes, verified merchant data, legal approval, and a controlled pilot.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadinessMetric label="Experience and interface" value={statusSnapshot.experienceProgress} helper="How complete the visible flows, interactions, responsive layouts, and four portal experiences are." icon={Layers3} />
            <ReadinessMetric label="Production readiness" value={statusSnapshot.productionReadiness} helper="Includes live backend, security, integrations, policies, support, testing, and launch operations." icon={Gauge} accent="#2563EB" />
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-secondary">Open client inputs</p><p className="mt-3 text-[34px] font-bold tracking-[-0.045em]">{statusSnapshot.clientInputsOpen}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-warning dark:bg-amber-950/35"><ClipboardCheck className="h-5 w-5" /></span></div>
              <p className="mt-5 text-sm font-semibold text-warning">Commercial, legal, operations, partnerships, and technology</p>
              <p className="mt-2 text-xs leading-5 text-tertiary">Grouped into six client work packages in this report.</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-secondary">Launch blockers</p><p className="mt-3 text-[34px] font-bold tracking-[-0.045em]">{statusSnapshot.launchBlockers}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-danger dark:bg-red-950/35"><AlertTriangle className="h-5 w-5" /></span></div>
              <p className="mt-5 text-sm font-semibold text-danger">Controlled beta only</p>
              <p className="mt-2 text-xs leading-5 text-tertiary">The architecture is integrated, but live payments and public operations remain gated until the listed release checks pass.</p>
            </Card>
          </section>

          <section className="mt-10 grid gap-4 xl:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-success dark:bg-green-950/35"><CheckCircle2 className="h-5 w-5" /></span><div><h2 className="font-bold">Ready for client review now</h2><p className="mt-1 text-sm text-secondary">What can be evaluated in the current download.</p></div></div>
              <ul className="mt-5 space-y-3">{reviewReady.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-secondary"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />{item}</li>)}</ul>
            </Card>
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-danger dark:bg-red-950/35"><XCircle className="h-5 w-5" /></span><div><h2 className="font-bold">Not live or production-certified yet</h2><p className="mt-1 text-sm text-secondary">Important boundaries of the present build.</p></div></div>
              <ul className="mt-5 space-y-3">{notLiveYet.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-secondary"><CircleDashed className="mt-1 h-4 w-4 shrink-0 text-warning" />{item}</li>)}</ul>
            </Card>
          </section>

          <section id="products" className="scroll-mt-36 mt-14">
            <SectionHeading eyebrow="Four connected apps" title="Current status by product" description="The visible product layer is substantially complete. Each portal now needs live data, provider integrations, approved policies, and production validation." />
            <div className="mt-6 grid gap-4 xl:grid-cols-2">{productAreas.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>
          </section>

          <section id="workstreams" className="scroll-mt-36 mt-14">
            <SectionHeading eyebrow="Detailed delivery view" title="Development workstreams" description="This shows what is implemented in the download and what still requires external configuration, client decisions, verification, or production testing." action={<Tabs value={workstreamFilter} onChange={setWorkstreamFilter} tabs={[{ value: "all", label: "All" }, { value: "complete", label: "Ready" }, { value: "active", label: "Active" }, { value: "attention", label: "Needs action" }]} />} />
            <div className="mt-6"><WorkstreamTable filter={workstreamFilter} /></div>
          </section>

          <section id="client-inputs" className="scroll-mt-36 mt-14">
            <SectionHeading eyebrow="Client action required" title="Requirements needed from the client" description="These inputs are not optional administration. They directly determine the backend architecture, partnerships, compliance boundary, operating model, costs, and launch schedule." />
            <Card className="mt-6 overflow-hidden border-amber-300/60 bg-amber-50/70 p-5 shadow-none dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-6">
              <div className="flex gap-4"><AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-warning" /><div><h3 className="font-bold text-amber-900 dark:text-amber-200">The next integration sprint should not begin on assumptions</h3><p className="mt-2 max-w-4xl text-sm leading-6 text-amber-800/85 dark:text-amber-300/80">Fees, payout rules, verification, legal responsibilities, provider choices, pilot supply, and support policies must be explicitly approved. Building these incorrectly would create expensive rework and operational risk.</p></div></div>
            </Card>
            <div className="mt-4 space-y-3">{clientRequirementGroups.map((group) => <RequirementAccordion key={group.id} group={group} open={openRequirements.includes(group.id)} onToggle={() => toggleRequirement(group.id)} />)}</div>
          </section>

          <section className="mt-14">
            <SectionHeading eyebrow="Immediate decisions" title="Highest-priority client decisions" description="These are ordered by delivery impact rather than convenience." />
            <Card className="mt-6 overflow-hidden">
              <div className="hidden grid-cols-[54px_minmax(0,1fr)_190px_210px_100px] gap-3 border-b bg-[var(--surface-2)]/60 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-tertiary lg:grid"><span>#</span><span>Decision</span><span>Owner</span><span>Required by</span><span>Impact</span></div>
              <div className="divide-y">{decisions.map((item, index) => <div key={item.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[54px_minmax(0,1fr)_190px_210px_100px] lg:items-center"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-2)] text-xs font-bold text-secondary">{String(index + 1).padStart(2, "0")}</span><div><p className="text-sm font-semibold">{item.decision}</p><p className="mt-1 text-xs text-tertiary lg:hidden">{item.owner} · {item.due}</p></div><p className="hidden text-sm text-secondary lg:block">{item.owner}</p><p className="hidden text-sm text-secondary lg:block">{item.due}</p><Badge tone={item.severity === "Critical" ? "danger" : "warning"}>{item.severity}</Badge></div>)}</div>
            </Card>
          </section>

          <section id="launch-plan" className="scroll-mt-36 mt-14">
            <SectionHeading eyebrow="Road to production" title="Development and launch stages" description="Dates should be committed only after the critical client inputs, external providers, and pilot participants are confirmed." />
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
              <LaunchTimeline />
              <div className="space-y-4">
                <Card className="p-5 sm:p-6">
                  <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Flag className="h-5 w-5" /></span><div><h3 className="font-bold">Production launch gates</h3><p className="mt-1 text-sm text-secondary">Every gate should have evidence and an accountable owner.</p></div></div>
                  <div className="mt-5 space-y-3">{launchGates.map((gate) => <div key={gate.name} className="flex items-start gap-3 rounded-2xl bg-[var(--surface-2)]/60 p-3.5"><span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", gate.status === "In review" ? "bg-blue-100 text-info dark:bg-blue-950/50" : "bg-amber-100 text-warning dark:bg-amber-950/50")}><CircleDashed className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{gate.name}</p><p className="mt-1 text-xs text-tertiary">{gate.status}</p></div></div>)}</div>
                </Card>
                <Card className="overflow-hidden bg-gradient-to-br from-[#201350] via-[#4c1d95] to-[#6d28d9] p-5 text-white sm:p-6">
                  <Rocket className="h-7 w-7" />
                  <h3 className="mt-5 text-2xl font-bold tracking-[-0.035em]">Recommended next move</h3>
                  <p className="mt-3 text-sm leading-6 text-white/74">Run a client decision workshop covering finance, legal, partnerships, operations, and technology. Convert the approved outcomes into the backend specification, integration backlog, pilot plan, owners, and delivery dates.</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/10 p-3.5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Output 1</p><p className="mt-2 text-sm font-semibold">Approved operating model</p></div>
                    <div className="rounded-2xl bg-white/10 p-3.5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Output 2</p><p className="mt-2 text-sm font-semibold">Integration and pilot roadmap</p></div>
                  </div>
                </Card>
              </div>
            </div>
          </section>

          <section className="devstatus-no-print mt-14 overflow-hidden rounded-[26px] border bg-[var(--surface)] p-5 shadow-card sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Review the current build</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.035em]">Open each Spotly portal from this report</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">The portals use realistic demonstration data so the client can review product direction before live infrastructure and external services are connected.</p></div>
              <div className="flex flex-wrap gap-2">{productAreas.map((product) => <Link key={product.id} href={product.route} className="inline-flex h-11 items-center gap-2 rounded-xl border bg-[var(--surface)] px-3.5 text-sm font-semibold hover:bg-[var(--surface-2)]"><Image src={product.logo} alt="" width={24} height={24} className="h-6 w-6 rounded-lg object-cover" />{product.name.replace("Spotly ", "")}<ArrowRight className="h-4 w-4" /></Link>)}</div>
            </div>
          </section>

          <footer className="mt-10 flex flex-col gap-3 border-t pt-6 text-xs text-tertiary sm:flex-row sm:items-center sm:justify-between">
            <p>Spotly client development status · Updated {statusSnapshot.updated}</p>
            <p>This report describes the supplied build and does not represent a production certification.</p>
          </footer>
        </div>
      </div>
    </PortalShell>
  );
}
