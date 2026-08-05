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
  Circle,
  LoaderCircle,
  Sparkles
} from "lucide-react";
import { Badge, Button, Card, Modal, ProgressBar, StatusBadge } from "@/components/ui";
import { getBusinessReadiness } from "@/data/business-config";
import { useBusinessWorkspace } from "@/components/business/business-context";

export const fieldClass = "surface h-12 w-full rounded-xl px-4 outline-none transition focus:ring-2 focus:ring-business/20";
export const textAreaClass = "surface min-h-28 w-full rounded-xl p-4 outline-none transition focus:ring-2 focus:ring-business/20";
export const selectClass = "surface h-12 w-full rounded-xl px-4 outline-none transition focus:ring-2 focus:ring-business/20";

export function FieldLabel({ label, hint, required, children, className = "" }) {
  return <label className={`block ${className}`}><span className="mb-2 flex items-center gap-1 text-sm font-semibold">{label}{required && <span className="text-danger">*</span>}</span>{children}{hint && <span className="mt-2 block text-xs leading-5 text-secondary">{hint}</span>}</label>;
}

export function BusinessSwitcher() {
  const { businessChoices, selectedBusinessId, setSelectedBusinessId, business } = useBusinessWorkspace();
  if (businessChoices.length <= 1) return <div className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business-soft text-business"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate text-sm font-bold">{business?.name || "Spotly Business"}</p><p className="truncate text-xs text-secondary">{business?.city || "Zimbabwe"} · {business?.category || "Business"}</p></div></div>;
  return <label className="relative flex min-w-[260px] items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><Building2 className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold uppercase tracking-[.12em] text-tertiary">Working in</span><select value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(event.target.value)} className="mt-0.5 w-full appearance-none bg-transparent pr-7 text-sm font-bold outline-none">{businessChoices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></span><ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-tertiary" /></label>;
}

export function ReadinessCard({ compact = false }) {
  const workspace = useBusinessWorkspace();
  const readiness = getBusinessReadiness(workspace);
  return <Card className="overflow-hidden"><div className="border-b p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-business" /><h2 className="text-lg font-bold">Launch readiness</h2></div><p className="mt-1 text-sm text-secondary">{readiness.complete} of {readiness.total} setup areas are complete.</p></div><Badge tone={readiness.percent === 100 ? "success" : readiness.percent >= 60 ? "warning" : "neutral"}>{readiness.percent}%</Badge></div><ProgressBar value={readiness.percent} className="mt-4" /></div><div>{readiness.checks.slice(0, compact ? 4 : readiness.checks.length).map((item) => <Link href={item.href} key={item.id} className="flex items-center gap-3 border-b px-5 py-4 last:border-0 hover:bg-[var(--surface-2)]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.done ? "bg-emerald-50 text-success" : "bg-amber-50 text-warning"}`}>{item.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div>{compact && readiness.checks.length > 4 && <div className="border-t p-4"><Link href="/business/settings"><Button variant="outline" size="sm" className="w-full">Review all setup checks<ArrowRight className="h-4 w-4" /></Button></Link></div>}</Card>;
}

export function CompletionBanner() {
  const workspace = useBusinessWorkspace();
  const readiness = getBusinessReadiness(workspace);
  if (readiness.percent === 100) return <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-success shadow-sm"><CheckCircle2 className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-emerald-950">Your business setup is complete.</h3><p className="mt-1 text-sm leading-6 text-emerald-800">Request a publication review when the profile, catalog, branch, finance, and team information are accurate.</p></div><Link href="/business/settings"><Button variant="success" size="sm">Request review</Button></Link></div>;
  const next = readiness.checks.find((item) => !item.done);
  return <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-warning shadow-sm"><AlertTriangle className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-amber-950">Next: {next?.label}</h3><p className="mt-1 text-sm leading-6 text-amber-800">{next?.description}</p></div>{next && <Link href={next.href}><Button variant="outline" size="sm">Continue setup<ArrowRight className="h-4 w-4" /></Button></Link>}</div>;
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
