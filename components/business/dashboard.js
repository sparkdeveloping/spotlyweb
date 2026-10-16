"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Store,
  UsersRound
} from "lucide-react";
import { Badge, Button, Card, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { CompletionBanner, ReadinessCard, WorkspaceContextSwitcher } from "@/components/business/shared";
import { saveBranch } from "@/lib/firebase-services";
import { pickupAvailability } from "@/lib/pickup-availability";
import { useToast } from "@/components/providers";
import { businessHref } from "@/lib/business-routing";

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function relativeTime(value) {
  const date = timestamp(value);
  if (!date) return "Recently";
  return date.toLocaleString("en-ZW", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}


function activityIconElement(type, className) {
  if (type === "ticketing_events") return <CalendarDays className={className} />;
  if (type === "appointments_services" || type === "accommodation_activities") return <Clock3 className={className} />;
  return <ShoppingBag className={className} />;
}

export function BusinessDashboard() {
  const data = useBusinessWorkspace();
  const { toast } = useToast();
  const [statusBusy, setStatusBusy] = useState(false);
  const href = (path, params = {}) => businessHref(path, { businessId: data.selectedBusinessId, ...params });
  const scopedOrders = data.orders.filter((order) => !data.selectedBranchId || !order.branchId || order.branchId === data.selectedBranchId);
  const finalStates = new Set(["picked_up", "completed", "cancelled", "refunded", "checked_in", "checked_out", "resolved"]);
  const activeOrders = scopedOrders.filter((order) => !finalStates.has(order.status));
  const urgentOrders = activeOrders.filter((order) => ["submitted", "new", "accepted", "preparing", "customer_arrived", "substitution_required"].includes(order.status));
  const activeProducts = data.products.filter((product) => product.active);
  const unavailableProducts = data.products.filter((product) => product.active && ["unavailable", "out_of_stock"].includes(product.stockStatus));
  const openSupport = data.support.filter((item) => !["closed", "resolved"].includes(item.status));
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
    urgentOrders.length > 0 && { title: `${urgentOrders.length} ${activityLabel.toLowerCase()} need action`, detail: "Open the queue and move each one to its next state.", href: href("/business/activity"), icon: ShoppingBag, tone: "warning" },
    unavailableProducts.length > 0 && { title: `${unavailableProducts.length} ${data.archetype.nouns.items} unavailable`, detail: "Confirm stock or availability before customers place another order.", href: href("/business/catalog"), icon: PackageCheck, tone: "warning" },
    openSupport.length > 0 && { title: `${openSupport.length} support conversation${openSupport.length === 1 ? "" : "s"} open`, detail: "Review replies and resolve anything blocking the location.", href: href("/business/support"), icon: MessageCircle, tone: "accent" },
    !data.business?.public && { title: "This business is still private", detail: "Review setup and publication requirements before customers can find it.", href: href("/business/launch"), icon: Store, tone: "neutral" }
  ].filter(Boolean);

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 border-b pb-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-semibold text-business">{data.business?.brandName || data.business?.name || "Spotly Business"}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em]">Today at {locationName}</h1><p className="mt-2 text-sm text-secondary">{locationCity} · {data.archetype.shortLabel}</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><WorkspaceContextSwitcher /></div></div>
    <CompletionBanner />
    <Card className="overflow-hidden"><div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex items-start gap-4"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${locationOpen ? "bg-success" : "bg-tertiary"}`} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{locationOpen ? "Location is operational" : "Location is paused"}</h2><StatusBadge status={data.business?.verificationStatus || "unverified"} />{data.business?.public && <Badge tone="success">Visible to customers</Badge>}</div><p className="mt-2 text-sm leading-6 text-secondary">{locationOpen ? `${activeOrders.length} active ${data.archetype.nouns.activity} · ${queueGroups.find((group) => group.id === "ready")?.records.length || 0} ready · ${availability.available ? `next pickup ${availability.earliest.date} ${availability.earliest.slot.label}` : availability.reason}` : "Customers cannot complete normal activity at this location until it is resumed."}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href={href("/business/branches")}>Review hours</Link></Button><Button loading={statusBusy} onClick={toggleLocationStatus}>{locationOpen ? "Pause location" : "Resume location"}</Button></div></div></Card>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]"><SectionCard title="Needs your attention" description="The most important work for this location right now"><div>{attention.map(({ title, detail, href, icon: Icon, tone }) => <Link href={href} key={title} className="flex items-start gap-4 border-b p-4 transition hover:bg-grouped last:border-b-0"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone === "warning" ? "bg-[var(--warning-soft)] text-[var(--on-warning-soft)]" : "bg-business-soft text-business"}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{detail}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary" /></Link>)}{!attention.length && <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-success" /><h3 className="mt-3 font-semibold">Everything is under control</h3><p className="mt-2 text-sm text-secondary">New orders, messages, approval requests, or availability issues will appear here.</p></div>}</div></SectionCard><ReadinessCard compact /></div>
    <SectionCard title={`${activityLabel} today`} description="Work grouped by the next action" action={<Button asChild size="sm" variant="outline"><Link href={href("/business/activity")}>Open full queue<ArrowRight className="h-4 w-4" /></Link></Button>}><div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">{queueGroups.map((group) => <div key={group.id} className="min-w-0"><div className="flex items-center justify-between bg-grouped px-4 py-3"><p className="font-semibold">{group.label}</p><Badge tone={group.tone}>{group.records.length}</Badge></div><div>{group.records.slice(0, 4).map((order) => <Link href={href("/business/activity", { order: order.id })} key={order.id} className="flex items-center gap-3 border-b p-4 hover:bg-grouped last:border-b-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-business-soft text-business">{activityIconElement(data.businessType, "h-4 w-4")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{order.number || order.reference || order.id.slice(0, 8).toUpperCase()}</span><span className="mt-1 block truncate text-xs text-secondary">{order.customerName || "Spotly customer"} · {relativeTime(order.createdAt)}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}{!group.records.length && <p className="p-5 text-sm leading-6 text-secondary">No {group.label.toLowerCase()} work right now.</p>}</div></div>)}</div></SectionCard>
    <div className="grid gap-5 lg:grid-cols-2"><SectionCard title="Before you close" description="Keep the location ready for the next customer"><div>{needsCatalog && <Link href={href("/business/catalog")} className="flex items-center gap-3 border-b p-4 hover:bg-grouped"><PackageCheck className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Review availability</span><span className="mt-1 block text-sm text-secondary">{activeProducts.length} active · {unavailableProducts.length} unavailable</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>}<Link href={href("/business/staff")} className="flex items-center gap-3 border-b p-4 hover:bg-grouped"><UsersRound className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Confirm team coverage</span><span className="mt-1 block text-sm text-secondary">{data.members.length} people currently have access</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link><Link href={href("/business/support")} className="flex items-center gap-3 p-4 hover:bg-grouped"><MessageCircle className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Resolve open support</span><span className="mt-1 block text-sm text-secondary">{openSupport.length ? `${openSupport.length} conversation${openSupport.length === 1 ? "" : "s"} waiting` : "Support inbox is clear"}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link></div></SectionCard><SectionCard title="Quick actions" description="Common location tasks"><div className="grid gap-3 p-4 sm:grid-cols-2"><Button asChild><Link href={href("/business/activity")}>{activityIconElement(data.businessType, "h-4 w-4")}Open {data.archetype.nouns.activity}</Link></Button>{needsCatalog && <Button asChild variant="outline"><Link href={href("/business/catalog")}><PackageCheck className="h-4 w-4" />Update {data.archetype.nouns.items}</Link></Button>}<Button asChild variant="outline"><Link href={href("/business/staff")}><UsersRound className="h-4 w-4" />Manage team</Link></Button><Button asChild variant="outline"><Link href={href("/business/support")}><MessageCircle className="h-4 w-4" />Contact support</Link></Button></div></SectionCard></div>
  </div>;
}
