"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
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
  Search,
  Sparkles
} from "lucide-react";
import { Badge, Button, Card, Modal, Overlay, ProgressBar, SearchField, StatusBadge } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { businessHref } from "@/lib/business-routing";
import { spotlyPortalUrl } from "@/lib/spotly-domains";

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
  const [businessOpen, setBusinessOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return businessChoices;
    return businessChoices.filter((item) => `${item.name || ""} ${item.brandName || ""} ${item.organizationName || ""} ${item.roleLabel || ""} ${item.city || ""}`.toLowerCase().includes(needle));
  }, [businessChoices, query]);

  function selectBusiness(id) {
    setSelectedBusinessId(id);
    setBusinessOpen(false);
    setQuery("");
  }

  function selectLocation(id) {
    setSelectedBranchId(id);
    setLocationOpen(false);
  }

  const businessName = business?.brandName || business?.name || "Spotly Business";
  const businessSubtitle = businessChoices.find((item) => item.id === selectedBusinessId)?.roleLabel || archetype?.shortLabel || business?.category || "Business";
  const locationName = selectedBranch?.branchName || selectedBranch?.name || selectedBranch?.displayName || "Location";

  return <>
    <div className={`surface grid gap-1 rounded-2xl p-2 shadow-card ${showBranch && branches.length ? "w-full sm:grid-cols-2 xl:w-[500px]" : compact ? "w-full sm:w-[300px]" : "w-full sm:w-[330px]"}`}>
      <button type="button" onClick={() => setBusinessOpen(true)} className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-grouped" aria-label="Choose or manage business">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">{business?.logo ? <Image unoptimized src={business.logo} alt="" width={40} height={40} className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-tertiary">Business</span>
          <span className="mt-0.5 block break-words text-sm font-bold leading-5">{businessName}</span>
          <span className="mt-0.5 block break-words text-[11px] leading-4 text-secondary">{businessSubtitle}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-tertiary" />
      </button>
      {showBranch && branches.length > 0 && <button type="button" onClick={() => setLocationOpen(true)} className="flex min-w-0 items-center gap-3 rounded-xl border-t px-3 py-2.5 text-left transition hover:bg-grouped sm:border-l sm:border-t-0" aria-label="Choose or manage location">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><MapPin className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-tertiary">{archetype?.nouns?.branch || "Location"}</span>
          <span className="mt-0.5 block break-words text-sm font-bold leading-5">{locationName}</span>
          <span className="mt-0.5 block break-words text-[11px] leading-4 text-secondary">{selectedBranch?.city || "Zimbabwe"}{branches.length > 1 ? ` · ${branches.length} available` : ""}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-tertiary" />
      </button>}
    </div>
    <Overlay open={businessOpen} onClose={() => { setBusinessOpen(false); setQuery(""); }} mode="sheet" title="Switch business" description="Choose another business in your Spotly Business account." label="Business switcher">
      <div className="space-y-4 p-4">
        <SearchField value={query} onChange={setQuery} placeholder="Search business, organization, role…" />
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {filtered.map((item) => <button key={item.id} type="button" onClick={() => selectBusiness(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-[var(--surface-2)] ${item.id === selectedBusinessId ? "border-business bg-business-soft" : ""}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-business-soft text-business">{item.logo ? <Image unoptimized src={item.logo} alt="" width={40} height={40} className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}</span>
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-5">{item.name || item.brandName}</span><span className="mt-1 block break-words text-xs leading-5 text-secondary">{[item.roleLabel, item.lifecycleLabel, item.accessibleLocationCount ? `${item.accessibleLocationCount} locations` : ""].filter(Boolean).join(" · ")}</span></span>
            {item.id === selectedBusinessId ? <Check className="h-4 w-4 text-business" /> : <ChevronDown className="h-4 w-4 -rotate-90 text-tertiary" />}
          </button>)}
          {!filtered.length && <div className="py-10 text-center text-sm text-secondary">No businesses match this search.</div>}
        </div>
        <div className="grid gap-2 border-t pt-4 sm:grid-cols-2"><Button asChild variant="outline"><Link href="/"><Building2 className="h-4 w-4" />View portfolio</Link></Button><Button asChild variant="outline"><Link href={spotlyPortalUrl("customer", "/claim")}><Search className="h-4 w-4" />Claim another business</Link></Button></div>
      </div>
    </Overlay>
    <Overlay open={locationOpen} onClose={() => setLocationOpen(false)} mode="sheet" title={`Choose ${archetype?.nouns?.branch || "location"}`} description="Switch the exact location you are operating." label="Location switcher">
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          {branches.map((item) => <button key={item.id} type="button" onClick={() => selectLocation(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:bg-[var(--surface-2)] ${item.id === selectedBranchId ? "border-business bg-business-soft" : ""}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><MapPin className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-5">{item.branchName || item.name || item.displayName || "Location"}</span><span className="mt-1 block break-words text-xs leading-5 text-secondary">{[item.city, item.address].filter(Boolean).join(" · ") || "Zimbabwe"}</span></span>
            {item.id === selectedBranchId && <Check className="h-4 w-4 text-business" />}
          </button>)}
        </div>
        <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
          <Button asChild variant="outline"><Link href={businessHref("/business/branches", { businessId: selectedBusinessId, edit: selectedBranchId || "" })}><MapPin className="h-4 w-4" />Edit selected location</Link></Button>
          <Button asChild variant="outline"><Link href={businessHref("/business/branches", { businessId: selectedBusinessId, action: "add" })}><Building2 className="h-4 w-4" />Add location</Link></Button>
        </div>
      </div>
    </Overlay>
  </>;
}
export function BusinessSwitcher(props) {
  return <WorkspaceContextSwitcher {...props} />;
}

export function ReadinessCard({ compact = false }) {
  const workspace = useBusinessWorkspace();
  const { lifecycle } = workspace;
  const checks = [lifecycle.access, ...lifecycle.launchChecks];
  const visible = compact ? checks.slice(0, 4) : checks;
  return <Card className="overflow-hidden"><div className="border-b p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-business" /><h2 className="text-lg font-bold">Launch checklist</h2></div><p className="mt-1 text-sm text-secondary">Your work is {lifecycle.merchantProgress}% complete. Spotly reviews are shown separately.</p></div><Badge tone={lifecycle.merchantProgress === 100 ? "success" : "accent"}>{lifecycle.merchantProgress}%</Badge></div><ProgressBar value={lifecycle.merchantProgress} label="Launch setup completion" className="mt-4" /></div><div>{visible.map((item) => {
    const complete = ["complete", "not_required"].includes(item.state);
    const waiting = item.state === "in_review";
    const label = complete ? (item.state === "not_required" ? "Not required" : "Complete") : waiting ? "Waiting on Spotly" : item.required ? "Your action" : "Optional";
    return <Link href={item.href || businessHref("/business/launch", { businessId: workspace.selectedBusinessId })} key={item.id} className="flex items-center gap-3 border-b px-5 py-4 last:border-0 hover:bg-[var(--surface-2)]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${complete ? "bg-[var(--success-soft)] text-success" : waiting ? "bg-[var(--info-soft)] text-info" : "bg-[var(--warning-soft)] text-warning"}`}>{complete ? <CheckCircle2 className="h-4 w-4" /> : waiting ? <span className="text-xs font-semibold">S</span> : <span className="text-xs font-semibold">!</span>}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="block text-sm font-semibold">{item.label}</span><Badge tone={complete ? "success" : waiting ? "info" : item.required ? "warning" : "neutral"}>{label}</Badge></span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>;
  })}</div>{compact && <div className="border-t p-4"><Button asChild variant="outline" size="sm" className="w-full"><Link href={businessHref("/business/launch", { businessId: workspace.selectedBusinessId })}>Open launch checklist<ArrowRight className="h-4 w-4" /></Link></Button></div>}</Card>;
}

export function CompletionBanner() {
  const workspace = useBusinessWorkspace();
  const { lifecycle } = workspace;
  if (lifecycle.stage === "live") return null;
  if (!lifecycle.nextAction) return <div className="flex flex-col gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--info)_35%,var(--border))] bg-[var(--info-soft)] p-5 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-info shadow-sm"><CheckCircle2 className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-[var(--on-info-soft)]">No action needed from you right now.</h3><p className="mt-1 text-sm leading-6 text-[var(--on-info-soft)]">Spotly is handling the remaining review work. Your launch setup remains saved.</p></div><Button asChild variant="outline" size="sm"><Link href={businessHref("/business/launch", { businessId: workspace.selectedBusinessId })}>View launch status</Link></Button></div>;
  return <div className="flex flex-col gap-4 rounded-2xl border border-business/20 bg-business-soft p-5 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-business shadow-sm"><Sparkles className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.14em] text-business">Recommended next action</p><h3 className="mt-1 font-bold text-[var(--on-business-soft)]">{lifecycle.nextAction.actionLabel}</h3><p className="mt-1 text-sm leading-6 text-secondary">{lifecycle.nextAction.label}</p></div><Button asChild size="sm"><Link href={lifecycle.nextAction.href}>{lifecycle.nextAction.actionLabel}<ArrowRight className="h-4 w-4" /></Link></Button></div>;
}

export function FullScreenTask({ open, state = "processing", title, description, steps = [], activeStep = 0, onDone, doneLabel = "Done" }) {
  return <Overlay open={open} onClose={state === "processing" ? undefined : onDone} mode="full" hideHeader closeOnBackdrop={false} label={title} className="bg-[#071b13] text-white shadow-none"><div className="flex min-h-full items-center justify-center p-5"><motion.div initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-xl text-center">
    <motion.div animate={state === "processing" ? { rotate: 360 } : { scale: [0.8, 1.12, 1] }} transition={state === "processing" ? { repeat: Infinity, duration: 1.4, ease: "linear" } : { duration: .55 }} className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[20px] ${state === "success" ? "bg-emerald-400 text-emerald-950" : state === "error" ? "bg-red-400 text-red-950" : "bg-[var(--surface)]/10"}`}>
      {state === "success" ? <CheckCircle2 className="h-12 w-12" /> : state === "error" ? <AlertTriangle className="h-12 w-12" /> : <LoaderCircle className="h-11 w-11" />}
    </motion.div>
    <h2 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h2>
    {description && <p aria-live="polite" className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/70">{description}</p>}
    {steps.length > 0 && <div className="mx-auto mt-8 max-w-md space-y-2 text-left" aria-label={`Progress: ${Math.min(activeStep + 1, steps.length)} of ${steps.length}`}>{steps.map((step, index) => <motion.div key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .08 }} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${index <= activeStep ? "bg-[var(--surface)]/10" : "bg-[var(--surface)]/[.04] text-white/40"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${index < activeStep || state === "success" ? "bg-emerald-400 text-emerald-950" : index === activeStep ? "bg-[var(--surface)] text-emerald-950" : "bg-[var(--surface)]/10"}`}>{index < activeStep || state === "success" ? <Check className="h-4 w-4" /> : index + 1}</span><span className="text-sm font-semibold">{step}</span></motion.div>)}</div>}
    {state !== "processing" && onDone && <Button onClick={onDone} data-autofocus className="mt-8 bg-[var(--surface)] text-emerald-950 hover:bg-[var(--surface-hover)]/90">{doneLabel}<ArrowRight className="h-4 w-4" /></Button>}
  </motion.div></div></Overlay>;
}

export function ConfirmDialog({ open, onClose, title, description, confirmLabel = "Confirm", onConfirm, danger = false, loading = false }) {
  return <Modal open={open} onClose={onClose} title={title} size="sm"><div className="p-5"><p className="text-sm leading-6 text-secondary">{description}</p><div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} className="flex-1" onClick={onConfirm} loading={loading}>{confirmLabel}</Button></div></div></Modal>;
}

export function LoadingState({ label = "Loading your business workspace…" }) {
  return <Card className="flex min-h-[320px] flex-col items-center justify-center p-10 text-center"><LoaderCircle className="h-7 w-7 animate-spin text-business" /><p className="mt-4 text-sm font-semibold">{label}</p><p className="mt-2 text-xs text-secondary">Spotly is loading the latest information for your business.</p></Card>;
}

export function SuccessMark({ label }) {
  return <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2 rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-xs font-bold text-[var(--on-success-soft)]"><Check className="h-3.5 w-3.5" />{label}</motion.span>;
}

export function EntityStatus({ business }) {
  return <div className="flex flex-wrap gap-2"><StatusBadge status={business?.verificationStatus || "unverified"} /><StatusBadge status={business?.status || "draft"} />{business?.public ? <Badge tone="success">Public</Badge> : <Badge tone="neutral">Private</Badge>}</div>;
}
