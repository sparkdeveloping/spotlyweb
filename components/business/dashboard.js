"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  MessageCircle,
  PackageCheck,
  Pause,
  Play,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound
} from "lucide-react";
import { Badge, Button, Card, StatusBadge } from "@/components/ui";
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

function sameDay(value, now = new Date()) {
  const date = timestamp(value);
  return Boolean(date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate());
}

function money(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

function activityIcon(type, className = "h-4 w-4") {
  if (type === "ticketing_events") return <CalendarDays className={className} />;
  if (type === "appointments_services" || type === "accommodation_activities") return <Clock3 className={className} />;
  return <ShoppingBag className={className} />;
}

function Metric({ label, value, detail, icon: Icon }) {
  return <div className="rounded-2xl border bg-[var(--surface)] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-secondary">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-.03em]">{value}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-business-soft text-business"><Icon className="h-5 w-5" /></span></div>{detail && <p className="mt-2 text-xs leading-5 text-secondary">{detail}</p>}</div>;
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
  const activityLabel = data.archetype.nouns.activityNav || (data.archetype.nouns.activity[0].toUpperCase() + data.archetype.nouns.activity.slice(1));
  const capabilities = new Set(data.business?.capabilities || data.archetype.capabilities);
  const needsCatalog = ["catalog", "menu", "events", "services", "listings", "profile"].some((item) => capabilities.has(item));
  const locationName = data.selectedBranch?.branchName || data.selectedBranch?.name || data.selectedBranch?.displayName || "Main location";
  const locationCity = data.selectedBranch?.city || "Zimbabwe";
  const locationOpen = data.selectedBranch?.status !== "paused" && data.selectedBranch?.status !== "inactive";
  const availability = pickupAvailability(data.selectedBranch);
  const todayOrders = scopedOrders.filter((order) => sameDay(order.createdAt || order.updatedAt));
  const todayValue = todayOrders.reduce((sum, order) => sum + Number(order.total || order.totalAmount || order.grandTotal || order.amount || 0), 0);

  async function toggleLocationStatus() {
    if (!data.selectedBranch) return;
    setStatusBusy(true);
    try {
      const nextStatus = locationOpen ? "paused" : "active";
      await saveBranch({ ...data.selectedBranch, status: nextStatus }, data.business.id, data.business.organizationId, data.user);
      toast(nextStatus === "paused" ? "This location is paused for customers." : "This location is accepting configured activity again.", { type: "success" });
    } catch (error) {
      toast(error.message || "The location status could not be changed.", { type: "error" });
    } finally { setStatusBusy(false); }
  }

  const queueGroups = [
    { id: "new", label: "New", statuses: ["submitted", "new"], tone: "warning" },
    { id: "working", label: data.businessType === "appointments_services" ? "Upcoming" : "In progress", statuses: ["accepted", "preparing", "in_progress", "confirmed", "scheduled"], tone: "accent" },
    { id: "ready", label: data.businessType === "appointments_services" ? "Arrived" : "Ready", statuses: ["ready", "ready_for_pickup", "customer_arrived", "checked_in"], tone: "success" }
  ].map((group) => ({ ...group, records: activeOrders.filter((order) => group.statuses.includes(order.status)) }));

  const attention = [
    urgentOrders.length > 0 && { title: `${urgentOrders.length} ${data.archetype.nouns.activity} need action`, detail: "Open the live queue and move each one to its next state.", href: href("/business/activity"), icon: ShoppingBag, tone: "warning" },
    unavailableProducts.length > 0 && { title: `${unavailableProducts.length} ${data.archetype.nouns.items} need an availability check`, detail: "Keep customer-facing availability accurate before the next transaction.", href: href("/business/catalog"), icon: PackageCheck, tone: "warning" },
    openSupport.length > 0 && { title: `${openSupport.length} support conversation${openSupport.length === 1 ? "" : "s"} open`, detail: "Review replies without making the customer explain the context again.", href: href("/business/support"), icon: MessageCircle, tone: "accent" },
    !data.business?.public && { title: "Customers cannot discover this business yet", detail: "Open Get live to see the exact requirement currently blocking publication.", href: href("/business/launch"), icon: Store, tone: "neutral" }
  ].filter(Boolean);

  const businessName = data.business?.brandName || data.business?.name || "Spotly Business";

  return <div className="v7-page-enter space-y-6">
    <section className="overflow-hidden rounded-2xl border bg-[var(--surface)]">
      <div className="grid gap-0 xl:grid-cols-[1fr_auto] xl:items-stretch">
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${locationOpen ? "bg-success" : "bg-tertiary"}`} /><p className="text-sm font-bold text-business">{businessName}</p><StatusBadge status={data.business?.verificationStatus || "unverified"} />{data.business?.public && <Badge tone="success">Visible to customers</Badge>}</div>
          <h1 className="mt-4 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Today at {locationName}</h1>
          <p className="mt-2 text-sm leading-6 text-secondary">{locationCity} · {data.archetype.shortLabel} · {locationOpen ? "Operating normally" : "Paused for customers"}</p>
          <div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link href={href("/business/activity")}>{activityIcon(data.businessType, "h-4 w-4")}Open {activityLabel}</Link></Button>{needsCatalog && <Button asChild variant="outline"><Link href={href("/business/catalog")}><Plus className="h-4 w-4" />Update {data.archetype.nouns.items}</Link></Button>}<Button variant="outline" loading={statusBusy} onClick={toggleLocationStatus}>{locationOpen ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{locationOpen ? "Pause location" : "Resume location"}</Button></div>
        </div>
        <div className="border-t bg-[var(--surface-2)] p-5 xl:w-[365px] xl:border-l xl:border-t-0"><p className="text-xs font-bold uppercase tracking-[.14em] text-tertiary">Operating context</p><div className="mt-4"><WorkspaceContextSwitcher /></div><p className="mt-4 text-xs leading-5 text-secondary">{locationOpen ? (availability.available ? `Next configured pickup: ${availability.earliest.date} ${availability.earliest.slot.label}` : availability.reason) : "Customer activity stays paused until this location is resumed."}</p></div>
      </div>
    </section>

    <CompletionBanner />

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={`${activityLabel} today`} value={todayOrders.length} detail={`${activeOrders.length} currently active`} icon={ShoppingBag} />
      <Metric label="Today's value" value={money(todayValue)} detail="Based on activity recorded today" icon={DollarSign} />
      <Metric label={`Active ${data.archetype.nouns.items}`} value={activeProducts.length} detail={unavailableProducts.length ? `${unavailableProducts.length} unavailable` : "Availability looks clear"} icon={PackageCheck} />
      <Metric label="Team access" value={data.members.length} detail={openSupport.length ? `${openSupport.length} support item${openSupport.length === 1 ? "" : "s"} open` : "Support inbox clear"} icon={UsersRound} />
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Card className="overflow-hidden"><div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-business" /><h2 className="text-lg font-bold">Needs your attention</h2></div><p className="mt-1 text-sm text-secondary">Only the work that can change what happens next.</p></div>{attention.length > 0 && <Badge tone="warning">{attention.length}</Badge>}</div><div>{attention.map(({ title, detail, href: target, icon: Icon, tone }) => <Link href={target} key={title} className="flex items-start gap-4 border-b p-5 transition hover:bg-grouped last:border-b-0 sm:px-6"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === "warning" ? "bg-[var(--warning-soft)] text-warning" : tone === "accent" ? "bg-business-soft text-business" : "bg-grouped text-secondary"}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="mt-1 block text-sm leading-6 text-secondary">{detail}</span></span><ArrowRight className="mt-3 h-4 w-4 text-tertiary" /></Link>)}{!attention.length && <div className="px-6 py-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-success" /><h3 className="mt-3 font-bold">Everything important is under control</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-secondary">New customer activity, availability problems, support replies, or launch actions will appear here first.</p></div>}</div></Card>
      <ReadinessCard compact />
    </section>

    <section className="overflow-hidden rounded-2xl border bg-[var(--surface)]"><div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="text-lg font-bold">{activityLabel} right now</h2><p className="mt-1 text-sm text-secondary">Grouped by the next operational state.</p></div><Button asChild size="sm" variant="outline"><Link href={href("/business/activity")}>Open full view<ArrowRight className="h-4 w-4" /></Link></Button></div><div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">{queueGroups.map((group) => <div key={group.id} className="min-w-0"><div className="flex items-center justify-between bg-[var(--surface-2)] px-5 py-3"><p className="text-sm font-bold">{group.label}</p><Badge tone={group.tone}>{group.records.length}</Badge></div><div>{group.records.slice(0, 4).map((order) => <Link href={href("/business/activity", { order: order.id })} key={order.id} className="flex items-center gap-3 border-b p-4 transition hover:bg-grouped last:border-b-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business">{activityIcon(data.businessType)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{order.number || order.reference || order.id.slice(0, 8).toUpperCase()}</span><span className="mt-1 block truncate text-xs text-secondary">{order.customerName || "Spotly customer"} · {relativeTime(order.createdAt)}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}{!group.records.length && <p className="p-5 text-sm leading-6 text-secondary">Nothing in {group.label.toLowerCase()} right now.</p>}</div></div>)}</div></section>

    <section className="grid gap-5 lg:grid-cols-2"><Card className="overflow-hidden"><div className="border-b px-5 py-4 sm:px-6"><h2 className="font-bold">Keep the business ready</h2><p className="mt-1 text-sm text-secondary">Small checks that prevent tomorrow&apos;s problems.</p></div><div>{needsCatalog && <Link href={href("/business/catalog")} className="flex items-center gap-3 border-b p-4 hover:bg-grouped sm:px-6"><PackageCheck className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Review availability</span><span className="mt-1 block text-sm text-secondary">{activeProducts.length} active · {unavailableProducts.length} unavailable</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link>}<Link href={href("/business/staff")} className="flex items-center gap-3 border-b p-4 hover:bg-grouped sm:px-6"><UsersRound className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Team coverage</span><span className="mt-1 block text-sm text-secondary">{data.members.length} people currently have access</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link><Link href={href("/business/support")} className="flex items-center gap-3 p-4 hover:bg-grouped sm:px-6"><MessageCircle className="h-5 w-5 text-business" /><span className="min-w-0 flex-1"><span className="block font-semibold">Support</span><span className="mt-1 block text-sm text-secondary">{openSupport.length ? `${openSupport.length} conversation${openSupport.length === 1 ? "" : "s"} open` : "No open support conversations"}</span></span><ArrowRight className="h-4 w-4 text-tertiary" /></Link></div></Card><Card className="p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-business">Quick actions</p><h2 className="mt-2 text-xl font-bold">Do the common things fast.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button asChild><Link href={href("/business/activity")}>{activityIcon(data.businessType)}Open {activityLabel}</Link></Button>{needsCatalog && <Button asChild variant="outline"><Link href={href("/business/catalog")}><PackageCheck className="h-4 w-4" />Manage {data.archetype.nouns.items}</Link></Button>}<Button asChild variant="outline"><Link href={href("/business/staff")}><UsersRound className="h-4 w-4" />Invite team</Link></Button><Button asChild variant="outline"><Link href={href("/business/support")}><MessageCircle className="h-4 w-4" />Get help</Link></Button></div></Card></section>
  </div>;
}
