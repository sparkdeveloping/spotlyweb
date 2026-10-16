"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Store
} from "lucide-react";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/providers";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { WorkspaceContextSwitcher } from "@/components/business/shared";
import { authenticatedFetch } from "@/lib/api-client";
import { BUSINESS_LIFECYCLE_STAGES } from "@/lib/business-lifecycle";
import { businessHref } from "@/lib/business-routing";

function stateMeta(item = {}) {
  if (item.state === "complete") return { label: "Complete", tone: "success", icon: CheckCircle2 };
  if (item.state === "in_review") return { label: "Waiting on Spotly", tone: "info", icon: Clock3 };
  if (item.state === "action_required") return { label: "Your action", tone: "warning", icon: CircleAlert };
  if (item.state === "blocked") return { label: "Blocked", tone: "warning", icon: LockKeyhole };
  if (item.state === "not_required") return { label: "Not required", tone: "neutral", icon: Check };
  return { label: item.required ? "Your action" : "Optional", tone: item.required ? "warning" : "neutral", icon: CircleAlert };
}

function LifecycleTimeline({ lifecycle }) {
  return <div className="rounded-2xl border bg-[var(--surface)] p-4 sm:p-5">
    <div className="flex items-center justify-between gap-4 md:hidden"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-tertiary">Stage {lifecycle.stageNumber} of {lifecycle.stageCount}</p><p className="mt-1 font-semibold">{lifecycle.stageLabel}</p></div><Badge tone={lifecycle.stage === "live" ? "success" : "accent"}>{lifecycle.statusLabel}</Badge></div>
    <ol className="hidden grid-cols-5 gap-2 md:grid" aria-label="Business launch stages">
      {BUSINESS_LIFECYCLE_STAGES.map((stage) => {
        const complete = stage.number < lifecycle.stageNumber || lifecycle.stage === "live";
        const active = stage.id === lifecycle.stage;
        return <li key={stage.id} aria-current={active ? "step" : undefined} className={`rounded-xl border p-3 ${active ? "border-business bg-business-soft" : "bg-[var(--surface)]"}`}><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-[var(--success)] text-[var(--on-success)]" : active ? "bg-business text-[var(--on-business)]" : "bg-grouped text-tertiary"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : stage.number}</span><span className="text-xs font-semibold">{stage.shortLabel}</span></div><p className="mt-2 text-[11px] leading-4 text-secondary">{active ? stage.label : complete ? "Complete" : "Upcoming"}</p></li>;
      })}
    </ol>
  </div>;
}

function CheckRow({ item }) {
  const meta = stateMeta(item);
  const Icon = meta.icon;
  const content = <>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.state === "complete" ? "bg-[var(--success-soft)] text-success" : item.state === "in_review" ? "bg-[var(--info-soft)] text-info" : item.state === "not_required" ? "bg-grouped text-tertiary" : "bg-[var(--warning-soft)] text-warning"}`}><Icon className="h-5 w-5" /></span>
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.label}</span><Badge tone={meta.tone}>{meta.label}</Badge>{!item.required && item.state !== "not_required" && <Badge tone="neutral">Optional</Badge>}</span><span className="mt-1.5 block text-sm leading-6 text-secondary">{item.description}</span>{item.id === "settlement" && item.details?.last4 && <span className="mt-1 block text-xs text-tertiary">Settlement account •••• {item.details.last4}</span>}</span>
    {item.href && <ArrowRight className="h-4 w-4 shrink-0 text-tertiary" />}
  </>;
  return item.href ? <Link href={item.href} className="flex items-start gap-3 border-b p-4 transition hover:bg-[var(--surface-2)] last:border-0">{content}</Link> : <div className="flex items-start gap-3 border-b p-4 last:border-0">{content}</div>;
}


function historyDate(value) {
  if (!value) return "";
  const date = value?.toDate?.() || new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LifecycleHistory({ business }) {
  const items = [];
  if (["approved", "verified"].includes(String(business?.verificationStatus || business?.claimStatus || "").toLowerCase())) items.push({ id: "access", label: "Business access approved", at: business?.verifiedAt || business?.claimReviewedAt || "" });
  if (business?.onboarding?.completedAt) items.push({ id: "basics", label: "Business basics completed", at: business.onboarding.completedAt });
  if (business?.moneySetup?.settlementStatus) items.push({ id: "settlement", label: business.moneySetup.settlementStatus === "verified" ? "Settlement account verified" : business.moneySetup.settlementStatus === "details_submitted" ? "Settlement account submitted" : "Settlement account updated", at: business.moneySetup.updatedAt || "" });
  if (business?.launchReview?.submittedAt) items.push({ id: "launch_submitted", label: "Final launch review submitted", at: business.launchReview.submittedAt });
  if (business?.launchReview?.approvedAt) items.push({ id: "launch_approved", label: "Final launch review approved", at: business.launchReview.approvedAt });
  for (const [index, event] of (business?.lifecycleHistory || []).entries()) {
    if (!event?.type) continue;
    const label = event.type === "business_went_live" ? "Business went live" : String(event.type).replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
    items.push({ id: `${event.type}:${index}`, label, at: event.at || "" });
  }
  const unique = [...new Map(items.map((item) => [`${item.label}:${historyDate(item.at)}`, item])).values()];
  if (!unique.length) return null;
  return <Card variant="bordered" className="overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-semibold">Lifecycle history</h2><p className="mt-1 text-xs text-secondary">Major access, setup and launch milestones. Routine operational edits stay out of this history.</p></div><div className="divide-y">{unique.map((item) => <div key={item.id} className="flex items-center gap-3 p-4"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" /><p className="min-w-0 flex-1 text-sm font-medium">{item.label}</p><span className="text-xs text-tertiary">{historyDate(item.at) || "Recorded"}</span></div>)}</div></Card>;
}
function ReviewChanges({ review }) {
  if (review.state !== "action_required" || !review.requestedChanges?.length) return null;
  const merchantEdit = ["re_review_required", "resubmission_required"].includes(review.status) && review.requestedChanges.some((item) => typeof item === "object" && item?.source === "merchant_edit");
  return <Card variant="bordered" className="border-warning/30 bg-[var(--warning-soft)] p-5"><div className="flex items-start gap-4"><CircleAlert className="mt-1 h-5 w-5 shrink-0 text-warning" /><div className="min-w-0 flex-1"><h2 className="font-semibold">{merchantEdit ? "Launch review needs an update" : "Spotly requested changes"}</h2><p className="mt-1 text-sm leading-6 text-secondary">{merchantEdit ? "A launch-critical business detail changed. Review the current setup and submit the update when it is ready." : "Fix these launch-review items, then resubmit the business."}</p><div className="mt-4 space-y-2">{review.requestedChanges.map((change, index) => { const item = typeof change === "string" ? { label: change } : change; return <div key={`${item.id || item.label}-${index}`} className="rounded-xl border bg-[var(--surface)] p-3"><p className="text-sm font-semibold">{item.label || item.message || item.id || "Launch requirement"}</p>{item.description && <p className="mt-1 text-xs leading-5 text-secondary">{item.description}</p>}{item.href && <Button asChild size="sm" variant="outline" className="mt-3"><Link href={item.href}>Fix this<ArrowRight className="h-4 w-4" /></Link></Button>}</div>; })}</div></div></div></Card>;
}

export function BusinessLifecycleBanner() {
  const { lifecycle, selectedBusinessId } = useBusinessWorkspace();
  if (!selectedBusinessId) return null;
  if (lifecycle.businessState === "suspended") {
    return <div className="mb-6 rounded-2xl border border-danger/25 bg-[var(--danger-soft)] p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone="danger">Business suspended</Badge><span className="text-sm font-semibold">Operational actions are restricted</span></div><p className="mt-2 text-sm text-secondary">Foundational setup remains saved. Spotly must clear the suspension before normal operations resume.</p></div><Button asChild size="sm" variant="outline"><Link href={businessHref("/business/support", { businessId: selectedBusinessId, topic: "business_suspension" })}>Contact Spotly Support<ArrowRight className="h-4 w-4" /></Link></Button></div></div>;
  }
  if (lifecycle.stage === "live") {
    const warning = lifecycle.operationalWarnings?.[0];
    if (!warning) return null;
    const waitingOnSpotly = warning.owner === "spotly";
    return <div className="mb-6 rounded-2xl border bg-[var(--surface)] p-4 shadow-card"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone={waitingOnSpotly ? "info" : "warning"}>{waitingOnSpotly ? "Waiting on Spotly" : "Review update required"}</Badge><span className="text-sm font-semibold">Your business remains live</span></div><p className="mt-2 text-sm text-secondary">{warning.description}</p></div><Button asChild size="sm" variant={waitingOnSpotly ? "outline" : "default"}><Link href={warning.href || businessHref("/business/launch", { businessId: selectedBusinessId })}>{waitingOnSpotly ? "View review status" : "Review launch update"}<ArrowRight className="h-4 w-4" /></Link></Button></div></div>;
  }
  const waiting = lifecycle.externalReviews[0] || (lifecycle.launchReview.owner === "spotly" ? lifecycle.launchReview : null);
  return <div className="mb-6 rounded-2xl border bg-[var(--surface)] p-4 shadow-card"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone="accent">Stage {lifecycle.stageNumber} of {lifecycle.stageCount}</Badge><span className="text-sm font-semibold">{lifecycle.statusLabel}</span><span className="text-sm text-secondary">· {lifecycle.merchantProgress}% of your launch setup complete</span></div>{lifecycle.nextAction ? <p className="mt-2 text-sm text-secondary"><span className="font-semibold text-[var(--text)]">Next:</span> {lifecycle.nextAction.label}</p> : waiting ? <p className="mt-2 text-sm text-secondary"><span className="font-semibold text-[var(--text)]">Waiting on Spotly:</span> {waiting.label}. You can continue improving other preparation items while this is reviewed.</p> : <p className="mt-2 text-sm text-secondary">No action is required from you right now.</p>}</div><div className="flex shrink-0 gap-2"><Button asChild variant="outline" size="sm"><Link href={businessHref("/business/launch", { businessId: selectedBusinessId })}>Launch checklist</Link></Button>{lifecycle.nextAction && <Button asChild size="sm"><Link href={lifecycle.nextAction.href}>{lifecycle.nextAction.actionLabel}<ArrowRight className="h-4 w-4" /></Link></Button>}</div></div></div>;
}

export function LockedBusinessFeature({ section }) {
  const { lifecycle, selectedBusinessId, archetype } = useBusinessWorkspace();
  const names = { today: "Today", dashboard: "Today", activity: archetype?.nouns?.activity ? `${archetype.nouns.activity[0].toUpperCase()}${archetype.nouns.activity.slice(1)}` : "Orders", insights: "Insights", promotions: "Promotions", kiosk: "Kiosk", settings: "Business settings" };
  const title = names[section] || "This feature";
  const blockers = lifecycle.launchBlockers.slice(0, 4);
  const suspended = lifecycle.businessState === "suspended";
  return <div className="mx-auto max-w-2xl py-10"><Card variant="bordered" className="p-7 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-business-soft text-business"><LockKeyhole className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-semibold">{suspended ? `${title} is unavailable while this business is suspended` : `${title} unlocks when this business is live`}</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-secondary">{suspended ? "This business remains a known Spotly business, but operational actions are restricted until Spotly clears the suspension. Foundational setup is not restarted." : "Spotly keeps operational tools separate from launch preparation so a private business never looks like it is already serving customers."}</p>{!suspended && blockers.length > 0 && <div className="mx-auto mt-6 max-w-lg rounded-2xl bg-grouped p-4 text-left"><p className="text-sm font-semibold">Still required</p><ul className="mt-3 space-y-2 text-sm text-secondary">{blockers.map((item) => <li key={item.id} className="flex gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>{item.label}: {item.description}</span></li>)}</ul></div>}<Button asChild className="mt-6"><Link href={suspended ? businessHref("/business/support", { businessId: selectedBusinessId, topic: "business_suspension" }) : businessHref("/business/launch", { businessId: selectedBusinessId })}>{suspended ? "Contact Spotly Support" : "View launch checklist"}<ArrowRight className="h-4 w-4" /></Link></Button></Card></div>;
}

export function BusinessLaunchView() {
  const workspace = useBusinessWorkspace();
  const { lifecycle, business, selectedBusinessId } = workspace;
  const [submitting, setSubmitting] = useState(false);
  const [serverBlockers, setServerBlockers] = useState([]);
  const submissionLock = useRef(false);
  const { toast } = useToast();
  const groups = [
    { id: "access", title: "Access", items: [lifecycle.access] },
    { id: "basics", title: "Business basics", items: lifecycle.launchChecks.filter((item) => item.group === "basics") },
    { id: "customer", title: "Customer experience", items: lifecycle.launchChecks.filter((item) => item.group === "customer") },
    { id: "money", title: "Money", items: lifecycle.launchChecks.filter((item) => item.group === "money") },
    { id: "team", title: "Team", items: lifecycle.launchChecks.filter((item) => item.group === "team") },
    { id: "system", title: "Spotly availability", items: lifecycle.launchChecks.filter((item) => item.group === "system") }
  ].filter((group) => group.items.length);

  async function submitReview() {
    if (submissionLock.current || submitting) return;
    submissionLock.current = true;
    setSubmitting(true);
    setServerBlockers([]);
    try {
      await authenticatedFetch("/api/business/launch-review/submit", { method: "POST", body: JSON.stringify({ businessId: selectedBusinessId }) });
      const reReview = lifecycle.launchReview.status === "re_review_required";
      await Promise.all([workspace.refreshLifecycle(selectedBusinessId, { silent: true }), workspace.refreshPortfolio()]);
      toast(reReview ? "Your business stays live while Spotly reviews the launch-critical changes." : "Your business is now waiting for Spotly's final launch review.", { title: reReview ? "Business changes submitted" : "Launch review submitted" });
    } catch (error) {
      const blockers = Array.isArray(error.blockers) ? error.blockers : [];
      if (blockers.length) {
        setServerBlockers(blockers);
        await Promise.all([workspace.refreshLifecycle(selectedBusinessId, { silent: true }), workspace.refreshPortfolio()]);
        toast(`${blockers[0].label}: ${blockers[0].description}`, { type: "error", title: "Launch requirements changed" });
      } else {
        toast(error.message || "Your launch review could not be submitted. Your setup is still saved.", { type: "error", title: "Submission failed" });
      }
    } finally { submissionLock.current = false; setSubmitting(false); }
  }

  const reviewMeta = stateMeta(lifecycle.launchReview);
  const ReviewIcon = reviewMeta.icon;
  const suspended = lifecycle.businessState === "suspended";
  const paused = lifecycle.businessState === "paused";
  if (suspended) {
    return <div className="space-y-6"><div className="flex flex-col gap-5 border-b pb-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-semibold text-business">{business?.brandName || business?.name || "Spotly Business"}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">This business is suspended</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Spotly has restricted customer operations. Your business setup and launch history remain intact and are not restarted.</p></div><WorkspaceContextSwitcher showBranch={false} compact /></div><LifecycleTimeline lifecycle={lifecycle} /><Card variant="bordered" className="border-danger/25 p-6"><div className="flex items-start gap-4"><CircleAlert className="mt-1 h-6 w-6 shrink-0 text-danger" /><div className="min-w-0 flex-1"><h2 className="font-semibold">Operational suspension</h2><p className="mt-2 text-sm leading-6 text-secondary">{business?.suspension?.reason || "Contact Spotly Support for the suspension reason and the steps required to restore operations."}</p>{business?.suspension?.suspendedAt && <p className="mt-2 text-xs text-tertiary">Suspension recorded {historyDate(business.suspension.suspendedAt) || "recently"}.</p>}<Button asChild className="mt-5"><Link href={businessHref("/business/support", { businessId: selectedBusinessId, topic: "business_suspension" })}>Contact Spotly Support<ArrowRight className="h-4 w-4" /></Link></Button></div></div></Card><LifecycleHistory business={business} /></div>;
  }
  return <div className="space-y-6">
    <div className="flex flex-col gap-5 border-b pb-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-semibold text-business">{business?.brandName || business?.name || "Spotly Business"}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">{paused ? "Your business is live · temporarily paused" : lifecycle.stage === "live" ? "Your business is live" : lifecycle.stage === "review" ? "Spotly launch review" : lifecycle.stage === "basics" ? "Set up your business" : "Prepare for launch"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">{paused ? "The business remains launched, but normal customer activity is temporarily paused until operations resume." : lifecycle.stage === "live" ? "Customer operations are enabled according to your configured locations and capabilities." : "One launch path separates your work from Spotly reviews so you always know what is complete and what comes next."}</p></div><WorkspaceContextSwitcher showBranch={false} compact /></div>
    <LifecycleTimeline lifecycle={lifecycle} />
    <ReviewChanges review={lifecycle.launchReview} />
    {serverBlockers.length > 0 && <Card variant="bordered" className="border-warning/30 bg-[var(--warning-soft)] p-5"><div className="flex items-start gap-4"><CircleAlert className="mt-1 h-5 w-5 shrink-0 text-warning" /><div className="min-w-0 flex-1"><h2 className="font-semibold">Launch requirements changed</h2><p className="mt-1 text-sm leading-6 text-secondary">Spotly rechecked the authoritative business record before submission. Fix the items below; the checklist has also been refreshed.</p><div className="mt-4 space-y-2">{serverBlockers.map((item) => <div key={item.id} className="rounded-xl border bg-[var(--surface)] p-3"><p className="text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs leading-5 text-secondary">{item.description}</p>{item.href && <Button asChild size="sm" variant="outline" className="mt-3"><Link href={item.href}>Fix this<ArrowRight className="h-4 w-4" /></Link></Button>}</div>)}</div></div></div></Card>}
    {lifecycle.stage !== "live" && <Card variant="bordered" className="p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.14em] text-tertiary">Your launch setup</p><div className="mt-2 flex flex-wrap items-baseline gap-3"><span className="text-4xl font-semibold tracking-tight">{lifecycle.merchantProgress}%</span><span className="text-sm text-secondary">complete</span></div><ProgressBar value={lifecycle.merchantProgress} label="Your launch setup progress" className="mt-4 h-2.5" />{lifecycle.externalReviewCount > 0 && <p className="mt-3 text-sm text-secondary"><Clock3 className="mr-1 inline h-4 w-4" />{lifecycle.externalReviewCount} {lifecycle.externalReviewCount === 1 ? "item is" : "items are"} waiting on Spotly. This does not reduce your setup percentage.</p>}</div>{lifecycle.nextAction ? <div className="lg:max-w-sm"><p className="text-sm font-semibold">Next</p><p className="mt-1 text-sm leading-6 text-secondary">{lifecycle.nextAction.label}</p><Button asChild className="mt-3"><Link href={lifecycle.nextAction.href}>{lifecycle.nextAction.actionLabel}<ArrowRight className="h-4 w-4" /></Link></Button></div> : <div className="lg:max-w-sm"><p className="text-sm font-semibold">No action needed right now</p><p className="mt-1 text-sm leading-6 text-secondary">Spotly is handling the remaining review work.</p></div>}</div></Card>}
    <div className="space-y-4">{groups.map((group) => <Card key={group.id} variant="bordered" className="overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-semibold">{group.title}</h2></div><div>{group.items.map((item) => <CheckRow key={item.id} item={item} />)}</div></Card>)}</div>
    <LifecycleHistory business={business} />
    <Card variant="bordered" className="overflow-hidden"><div className="flex items-start gap-4 border-b p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{lifecycle.stage === "live" && lifecycle.launchReview.status !== "approved" ? "Business change review" : "Final launch review"}</h2><Badge tone={reviewMeta.tone}>{reviewMeta.label}</Badge></div><p className="mt-2 text-sm leading-6 text-secondary">{lifecycle.stage === "live" && lifecycle.launchReview.status !== "approved" ? "Launch-critical edits are re-reviewed without putting a live business back into onboarding. Ordinary stock, price, hours, team and pickup updates do not trigger this review." : "This is the last Spotly review before customers can find and use this business. It is separate from business-access approval, settlement verification, and individual product/image review."}</p></div></div><div className="p-5"><div className="flex items-start gap-3 rounded-xl bg-grouped p-4"><ReviewIcon className="mt-0.5 h-5 w-5 shrink-0 text-business" /><div><p className="font-semibold">{lifecycle.launchReview.description}</p>{lifecycle.launchReview.submittedAt && <p className="mt-1 text-xs text-tertiary">Submission recorded. No duplicate review is required while this review remains active.</p>}</div></div>{lifecycle.canSubmitLaunchReview && serverBlockers.length === 0 && <Button className="mt-5" onClick={submitReview} loading={submitting}><ShieldCheck className="h-4 w-4" />{lifecycle.launchReview.status === "re_review_required" ? "Submit business changes for review" : ["changes_requested", "resubmission_required"].includes(lifecycle.launchReview.status) ? "Resubmit for Spotly review" : "Submit for Spotly review"}</Button>}{lifecycle.launchReview.state === "in_review" && <p className="mt-4 text-sm text-secondary">No action is required from you unless Spotly requests a change. You can continue improving non-critical catalogue and operational details while review is underway.</p>}{lifecycle.stage === "live" && lifecycle.businessState !== "suspended" && <Button asChild className="mt-5"><Link href={businessHref("/business/today", { businessId: selectedBusinessId })}><Store className="h-4 w-4" />Open Today</Link></Button>}</div></Card>
  </div>;
}
