"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound
} from "lucide-react";
import { Badge, Button, Card, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { CompletionBanner, ReadinessCard, WorkspaceContextSwitcher } from "@/components/business/shared";
import { getBusinessReadiness } from "@/data/business-config";
import { saveBranch } from "@/lib/firebase-services";
import { pickupAvailability } from "@/lib/pickup-availability";
import { useToast } from "@/components/providers";

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function relativeTime(value) {
  const date = timestamp(value);
  if (!date) return "Recently";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleDateString("en-ZW", { day: "numeric", month: "short" });
}

function SetupWelcome({ data }) {
  const readiness = getBusinessReadiness(data);
  const next = readiness.checks.find((item) => !item.done);
  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow="Spotly Business" title={`Let’s finish setting up ${data.business?.brandName || data.business?.name || "your business"}`} description="Spotly will introduce one decision at a time. Finance, team controls, and advanced tools stay out of the way until they are relevant." /><WorkspaceContextSwitcher showBranch={false} /></div>
    <Card className="relative overflow-hidden border-business/20 bg-business-soft p-7 sm:p-10"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-business/5" /><div className="relative max-w-3xl"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-business"><Sparkles className="h-7 w-7" /></span><p className="mt-7 text-xs font-semibold uppercase tracking-[.16em] text-business">Recommended next step</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">{next?.label || "Review the business"}</h1><p className="mt-4 max-w-2xl text-base leading-8 text-secondary">{next?.description || "Confirm the essentials before opening the full workspace."}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild ><Link href="/business/setup">Continue guided setup<ArrowRight className="h-4 w-4" /></Link></Button><Button asChild variant="outline" ><Link href="/business/support">Get setup help</Link></Button></div></div></Card>
    <div className="grid gap-5 xl:grid-cols-[1fr_390px]"><SectionCard title="What Spotly is preparing" description="Only the essential decisions are required before the operational workspace opens"><div className="grid gap-0 sm:grid-cols-2">{[
      [Store, "Business and brand", data.business?.businessType ? "Business type selected" : "Needs confirmation"],
      [data.archetype.icon, data.archetype.label, `${data.business?.capabilities?.length || data.archetype.capabilities.length} relevant capabilities`],
      [PackageCheck, data.archetype.nouns.catalog, data.products.length ? `${data.products.length} drafts ready` : "Starter structure available"],
      [CheckCircle2, "Publication path", `${readiness.complete} of ${readiness.total} essentials complete`]
    ].map(([Icon, title, detail], index) => <div key={title} className={`p-5 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "sm:border-r" : ""}`}><Icon className="h-5 w-5 text-business" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-secondary">{detail}</p></div>)}</div></SectionCard><ReadinessCard compact /></div>
  </div>;
}

function activityIcon(type) {
  if (type === "ticketing_events") return CalendarCheck2;
  if (type === "appointments_services" || type === "accommodation_activities") return Clock3;
  return ShoppingBag;
}

export function BusinessDashboard() {
  const data = useBusinessWorkspace();
  const { toast } = useToast();
  const [statusBusy, setStatusBusy] = useState(false);
  if (!data.setupComplete) return <SetupWelcome data={data} />;

  const scopedOrders = data.orders.filter((order) => !data.selectedBranchId || !order.branchId || order.branchId === data.selectedBranchId);
  const finalStates = new Set(["picked_up", "completed", "cancelled", "refunded", "checked_in", "checked_out", "resolved"]);
  const activeOrders = scopedOrders.filter((order) => !finalStates.has(order.status));
  const urgentOrders = activeOrders.filter((order) => ["submitted", "new", "accepted", "preparing", "customer_arrived", "substitution_required"].includes(order.status));
  const activeProducts = data.products.filter((product) => product.active);
  const unavailableProducts = data.products.filter((product) => product.active && ["unavailable", "out_of_stock"].includes(product.stockStatus));
  const openSupport = data.support.filter((item) => !["closed", "resolved"].includes(item.status));
  const ActivityIcon = activityIcon(data.businessType);
  const activityLabel = data.archetype.nouns.activity[0].toUpperCase() + data.archetype.nouns.activity.slice(1);
  const capabilities = new Set(data.business?.capabilities || data.archetype.capabilities);
  const needsCatalog = ["catalog", "menu", "events", "services", "listings"].some((item) => capabilities.has(item));
  const locationName = data.selectedBranch?.branchName || data.selectedBranch?.name || data.selectedBranch?.displayName || "Main location";
  const locationCity = data.selectedBranch?.city || "Zimbabwe";
  const locationOpen = data.selectedBranch?.status !== "paused" && data.selectedBranch?.status !== "inactive";
  const availability = pickupAvailability(data.selectedBranch);
  async function toggleLocationStatus() {
    if (!data.selectedBranch) return;
    setStatusBusy(true);
    try {
      const nextStatus = locationOpen ? "paused" : "active";
      await saveBranch({ ...data.selectedBranch, status: nextStatus }, data.business.id, data.business.organizationId, data.user);
      toast(nextStatus === "paused" ? "This location is paused for customers." : "This location is accepting configured activity again.", { type: "success" });
    } catch (error) { toast(error.message || "The location status could not be changed.", { type: "error" }); }
    finally { setStatusBusy(false); }
  }
  const queueGroups = [
    { id: "new", label: "New", statuses: ["submitted", "new"], tone: "warning" },
    { id: "preparing", label: "Preparing", statuses: ["accepted", "preparing", "in_progress"], tone: "accent" },
    { id: "ready", label: "Ready", statuses: ["ready", "ready_for_pickup", "customer_arrived"], tone: "success" }
  ].map((group) => ({ ...group, records: activeOrders.filter((order) => group.statuses.includes(order.status)) }));
  const attention = [
    urgentOrders.length > 0 && { title: `${urgentOrders.length} ${activityLabel.toLowerCase()} need action`, detail: "Open the queue and move each one to its next state.", href: "/business/activity", icon: ActivityIcon, tone: "warning" },
    unavailableProducts.length > 0 && { title: `${unavailableProducts.length} ${data.archetype.nouns.items} unavailable`, detail: "Confirm stock or availability before customers place another order.", href: "/business/catalog", icon: PackageCheck, tone: "warning" },
    openSupport.length > 0 && { title: `${openSupport.length} support conversation${openSupport.length === 1 ? "" : "s"} open`, detail: "Review replies and resolve anything blocking the location.", href: "/business/support", icon: MessageCircle, tone: "accent" },
    !data.business?.public && { title: "This business is still private", detail: "Review setup and publication requirements before customers can find it.", href: "/business/setup", icon: Store, tone: "neutral" }
  ].filter(Boolean);

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 border-b pb-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-semibold text-business">{data.business?.brandName || data.business?.name || "Spotly Business"}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Today at {locationName}</h1><p className="mt-2 text-sm text-secondary">{locationCity} · {data.archetype.shortLabel}</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><WorkspaceContextSwitcher /><Button asChild variant="outline"><Link href="/business/branches">Manage location</Link></Button></div></div>
    <CompletionBanner />
    <Card className="overflow-hidden"><div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex items-start gap-4"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${locationOpen ? "bg-success" : "bg-tertiary"}`} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{locationOpen ? "Location is operational" : "Location is paused"}</h2><StatusBadge status={data.business?.verificationStatus || "unverified"} />{data.business?.public && <Badge tone="success">Visible to customers</Badge>}</div><p className="mt-2 text-sm leading-6 text-secondary">{locationOpen ? `${activeOrders.length} active ${data.archetype.nouns.activity} · ${queueGroups.find((group) => group.id === "ready")?.records.length || 0} ready · ${availability.available ? `next pickup ${availability.earliest.date} ${availability.earliest.slot.label}` : availability.reason}` : "Customers cannot complete normal activity at this location until it is resumed."}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/business/branches">Review hours</Link></Button><Button loading={statusBusy} onClick={toggleLocationStatus}>{locationOpen ? "Pause location" : "Resume location"}</Button></div></div></Card>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><SectionCard title="Needs your attention" description="The most important work for this location right now"><div>{attention.map(({ title, detail, href, icon: Icon, tone }) => <Link href={href} key={title} className="flex items-start gap-4 border-b p-4 transition hover:bg-grouped last:border-b-0"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone === "warning" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-business-soft text-business"}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{detail}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary" /></Link>)}{!attention.length && <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-success" /><h3 className="mt-3 font-semibold">Everything is under control</h3><p className="mt-2 text-sm text-secondary">New orders, messages, approval requests, or availability issues will appear here.</p></div>}</div></SectionCard><ReadinessCard compact /></div>
    <SectionCard title={`${activityLabel} today`} description="Work grouped by the next action" action={<Button asChild size="sm" variant="outline"><Link href="/business/activity">Open full queue<ArrowRight className="h-4 w-4" /></Link></Button>}><div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">{queueGroups.map((group) => <div key={group.id} className="min-w-0"><div className="flex items-center justify-between bg-grouped px-4 py-3"><p className="font-semibold">{group.label}</p><Badge tone={group.tone}>{group.records.length}</Badge></div><div>{group.records.slice(0, 4).map((order) => <Link href={`/business/activity?order=${order.id}`} key={order.id} className="flex items-center gap-3 border-b p-4 hover:bg-grouped last:border-b-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-business-soft text-business"><ActivityIcon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{order.number || order.reference || order.id.slice(0, 8).toUpperCase()}</span><span className="mt-1 block truncate text-xs text-secondary">{order.customerName || "Spotly customer"} · {relativeTime(order.createdAt)}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}{!group.records.length && <p className="p-5 text-sm leading-6 text-secondary">No {group.label.toLowerCase()} work right now.</p>}</div></div>)}</div></SectionCard>
    <div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Before you close" description="Keep the location ready for the next customer"><div>{needsCatalog && <Link href="/business/catalog" className="flex items-center gap-3 border-b p-4 hover:bg-grouped"><PackageCheck className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Review availability</span><span className="mt-1 block text-sm text-secondary">{activeProducts.length} active · {unavailableProducts.length} unavailable</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>}<Link href="/business/staff" className="flex items-center gap-3 border-b p-4 hover:bg-grouped"><UsersRound className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Confirm team coverage</span><span className="mt-1 block text-sm text-secondary">{data.members.length} people currently have access</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link><Link href="/business/support" className="flex items-center gap-3 p-4 hover:bg-grouped"><MessageCircle className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Resolve open support</span><span className="mt-1 block text-sm text-secondary">{openSupport.length ? `${openSupport.length} conversation${openSupport.length === 1 ? "" : "s"} waiting` : "Support inbox is clear"}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link></div></SectionCard><SectionCard title="Quick actions" description="Common location tasks"><div className="grid gap-3 p-4 sm:grid-cols-2"><Button asChild><Link href="/business/activity"><ActivityIcon className="h-4 w-4" />Open {data.archetype.nouns.activity}</Link></Button>{needsCatalog && <Button asChild variant="outline"><Link href="/business/catalog"><PackageCheck className="h-4 w-4" />Update {data.archetype.nouns.items}</Link></Button>}<Button asChild variant="outline"><Link href="/business/staff"><UsersRound className="h-4 w-4" />Manage team</Link></Button><Button asChild variant="outline"><Link href="/business/support"><MessageCircle className="h-4 w-4" />Contact support</Link></Button></div></SectionCard></div>
  </div>;
}
