"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  MapPin,
  Sparkles
} from "lucide-react";
import { Badge, Button, Card, Modal, Overlay, ProgressBar, StatusBadge } from "@/components/ui";
import { getBusinessReadiness } from "@/data/business-config";
import { useBusinessWorkspace } from "@/components/business/business-context";

export const fieldClass = "surface h-12 w-full rounded-xl px-4 outline-none transition focus:ring-2 focus:ring-business/20";
export const textAreaClass = "surface min-h-28 w-full rounded-xl p-4 outline-none transition focus:ring-2 focus:ring-business/20";
export const selectClass = "surface h-12 w-full rounded-xl px-4 outline-none transition focus:ring-2 focus:ring-business/20";

export function FieldLabel({ label, hint, required, children, className = "" }) {
  return <label className={`block ${className}`}><span className="mb-2 flex items-center gap-1 text-sm font-semibold">{label}{required && <span className="text-danger">*</span>}</span>{children}{hint && <span className="mt-2 block text-xs leading-5 text-secondary">{hint}</span>}</label>;
}

export function WorkspaceContextSwitcher({ showBranch = true, compact = false }) {
  const {
    businessChoices,
    selectedBusinessId,
    setSelectedBusinessId,
    business,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    archetype
  } = useBusinessWorkspace();

  return <div className={`surface flex flex-col gap-2 rounded-2xl p-2 shadow-card ${compact ? "min-w-[280px]" : "min-w-[300px] sm:flex-row"}`}>
    <label className="relative flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 hover:bg-grouped">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Building2 className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-tertiary">Business</span>
        {businessChoices.length > 1 ? <select aria-label="Choose business" value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(event.target.value)} className="mt-0.5 w-full appearance-none truncate bg-transparent pr-6 text-sm font-bold outline-none">{businessChoices.map((item) => <option key={item.id} value={item.id}>{item.brandName || item.name}</option>)}</select> : <span className="mt-0.5 block truncate text-sm font-bold">{business?.brandName || business?.name || "Spotly Business"}</span>}
        <span className="mt-0.5 block truncate text-[11px] text-secondary">{archetype?.shortLabel || business?.category || "Business"}</span>
      </span>
      {businessChoices.length > 1 && <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-tertiary" />}
    </label>
    {showBranch && branches.length > 0 && <label className="relative flex min-w-0 flex-1 items-center gap-3 rounded-xl border-t px-3 py-2 hover:bg-grouped sm:border-l sm:border-t-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><MapPin className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-tertiary">{archetype?.nouns?.branch || "Location"}</span>
        {branches.length > 1 ? <select aria-label="Choose location" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="mt-0.5 w-full appearance-none truncate bg-transparent pr-6 text-sm font-bold outline-none">{branches.map((item) => <option key={item.id} value={item.id}>{item.branchName || item.name || item.displayName}</option>)}</select> : <span className="mt-0.5 block truncate text-sm font-bold">{selectedBranch?.branchName || selectedBranch?.name || selectedBranch?.displayName || "Main location"}</span>}
        <span className="mt-0.5 block truncate text-[11px] text-secondary">{selectedBranch?.city || "Zimbabwe"}{branches.length > 1 ? ` · ${branches.length} available` : ""}</span>
      </span>
      {branches.length > 1 && <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-tertiary" />}
    </label>}
  </div>;
}

export function BusinessSwitcher(props) {
  return <WorkspaceContextSwitcher {...props} />;
}

export function ReadinessCard({ compact = false }) {
  const workspace = useBusinessWorkspace();
  const readiness = getBusinessReadiness(workspace);
  return <Card className="overflow-hidden"><div className="border-b p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-business" /><h2 className="text-lg font-bold">Business launch path</h2></div><p className="mt-1 text-sm text-secondary">{readiness.requiredComplete} of {readiness.requiredTotal} required steps are complete.</p></div><Badge tone={readiness.percent === 100 ? "success" : readiness.percent >= 60 ? "warning" : "neutral"}>{readiness.percent}%</Badge></div><ProgressBar value={readiness.percent} className="mt-4" /></div><div>{readiness.checks.slice(0, compact ? 4 : readiness.checks.length).map((item, index) => <Link href={item.href} key={item.id} className="flex items-center gap-3 border-b px-5 py-4 last:border-0 hover:bg-[var(--surface-2)]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.done ? "bg-emerald-50 text-success" : index === readiness.checks.findIndex((entry) => !entry.done && !entry.optional) ? "bg-business text-white" : "bg-grouped text-tertiary"}`}>{item.done ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div>{compact && readiness.checks.length > 4 && <div className="border-t p-4"><Button asChild variant="outline" size="sm" className="w-full"><Link href="/business/setup">Continue guided setup<ArrowRight className="h-4 w-4" /></Link></Button></div>}</Card>;
}

export function CompletionBanner() {
  const workspace = useBusinessWorkspace();
  const readiness = getBusinessReadiness(workspace);
  if (readiness.percent === 100) return <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-success shadow-sm"><CheckCircle2 className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-emerald-950">The essentials are ready.</h3><p className="mt-1 text-sm leading-6 text-emerald-800">Review the customer experience and request publication when every visible detail is accurate.</p></div><Button asChild variant="success" size="sm"><Link href="/business/settings">Review publication</Link></Button></div>;
  const next = readiness.checks.find((item) => !item.done && !item.optional) || readiness.checks.find((item) => !item.done);
  return <div className="flex flex-col gap-4 rounded-2xl border border-business/20 bg-business-soft p-5 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-business shadow-sm"><Sparkles className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.14em] text-business">Recommended next step</p><h3 className="mt-1 font-bold text-emerald-950">{next?.label}</h3><p className="mt-1 text-sm leading-6 text-emerald-800">{next?.description}</p></div>{next && <Button asChild size="sm"><Link href={next.href}>Continue<ArrowRight className="h-4 w-4" /></Link></Button>}</div>;
}

export function FullScreenTask({ open, state = "processing", title, description, steps = [], activeStep = 0, onDone, doneLabel = "Continue" }) {
  return <Overlay open={open} onClose={state === "processing" ? undefined : onDone} mode="full" hideHeader closeOnBackdrop={false} label={title} className="bg-[#071b13] text-white shadow-none"><div className="flex min-h-full items-center justify-center p-5"><motion.div initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-xl text-center">
    <motion.div animate={state === "processing" ? { rotate: 360 } : { scale: [0.8, 1.12, 1] }} transition={state === "processing" ? { repeat: Infinity, duration: 1.4, ease: "linear" } : { duration: .55 }} className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[20px] ${state === "success" ? "bg-emerald-400 text-emerald-950" : state === "error" ? "bg-red-400 text-red-950" : "bg-white/10"}`}>
      {state === "success" ? <CheckCircle2 className="h-12 w-12" /> : state === "error" ? <AlertTriangle className="h-12 w-12" /> : <LoaderCircle className="h-11 w-11" />}
    </motion.div>
    <h2 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h2>
    {description && <p aria-live="polite" className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/70">{description}</p>}
    {steps.length > 0 && <div className="mx-auto mt-8 max-w-md space-y-2 text-left" aria-label={`Progress: ${Math.min(activeStep + 1, steps.length)} of ${steps.length}`}>{steps.map((step, index) => <motion.div key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .08 }} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${index <= activeStep ? "bg-white/10" : "bg-white/[.04] text-white/40"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${index < activeStep || state === "success" ? "bg-emerald-400 text-emerald-950" : index === activeStep ? "bg-white text-emerald-950" : "bg-white/10"}`}>{index < activeStep || state === "success" ? <Check className="h-4 w-4" /> : index + 1}</span><span className="text-sm font-semibold">{step}</span></motion.div>)}</div>}
    {state !== "processing" && onDone && <Button onClick={onDone} data-autofocus className="mt-8 bg-white text-emerald-950 hover:bg-white/90">{doneLabel}<ArrowRight className="h-4 w-4" /></Button>}
  </motion.div></div></Overlay>;
}

export function ConfirmDialog({ open, onClose, title, description, confirmLabel = "Confirm", onConfirm, danger = false, loading = false }) {
  return <Modal open={open} onClose={onClose} title={title} size="sm"><div className="p-5"><p className="text-sm leading-6 text-secondary">{description}</p><div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} className="flex-1" onClick={onConfirm} loading={loading}>{confirmLabel}</Button></div></div></Modal>;
}

export function LoadingState({ label = "Loading your business workspace…" }) {
  return <Card className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center"><LoaderCircle className="h-7 w-7 animate-spin text-business" /><p className="mt-4 text-sm font-semibold">{label}</p><p className="mt-2 text-xs text-secondary">Spotly is loading the latest information for your business.</p></Card>;
}

export function SuccessMark({ label }) {
  return <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><Check className="h-3.5 w-3.5" />{label}</motion.span>;
}

export function EntityStatus({ business }) {
  return <div className="flex flex-wrap gap-2"><StatusBadge status={business?.verificationStatus || "unverified"} /><StatusBadge status={business?.status || "draft"} />{business?.public ? <Badge tone="success">Public</Badge> : <Badge tone="neutral">Private</Badge>}</div>;
}
