"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  PackageCheck,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound
} from "lucide-react";
import { Badge, Button, Card, MetricCard, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { CompletionBanner, ReadinessCard, WorkspaceContextSwitcher } from "@/components/business/shared";
import { getBusinessReadiness } from "@/data/business-config";

function orderTotal(order) {
  return Number(order.totals?.total ?? order.total ?? 0);
}

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
    <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-business to-emerald-500 p-7 text-white sm:p-10"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10" /><div className="relative max-w-3xl"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Sparkles className="h-7 w-7" /></span><p className="mt-7 text-xs font-black uppercase tracking-[.16em] text-white/65">Recommended next step</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{next?.label || "Review the business"}</h1><p className="mt-4 max-w-2xl text-base leading-8 text-white/75">{next?.description || "Confirm the essentials before opening the full workspace."}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild className="bg-white text-business hover:bg-white/90"><Link href="/business/setup">Continue guided setup<ArrowRight className="h-4 w-4" /></Link></Button><Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20"><Link href="/business/support">Get setup help</Link></Button></div></div></Card>
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
  if (!data.setupComplete) return <SetupWelcome data={data} />;

  const scopedOrders = data.orders.filter((order) => !data.selectedBranchId || !order.branchId || order.branchId === data.selectedBranchId);
  const activeOrders = scopedOrders.filter((order) => !["picked_up", "completed", "cancelled", "refunded", "checked_in", "checked_out", "resolved"].includes(order.status));
  const urgentOrders = activeOrders.filter((order) => ["submitted", "new", "accepted", "preparing", "customer_arrived"].includes(order.status));
  const activeProducts = data.products.filter((product) => product.active);
  const unavailableProducts = data.products.filter((product) => product.active && ["unavailable", "out_of_stock"].includes(product.stockStatus));
  const openSupport = data.support.filter((item) => !["closed", "resolved"].includes(item.status));
  const completedOrders = scopedOrders.filter((order) => ["picked_up", "completed", "checked_in", "checked_out", "issued", "resolved"].includes(order.status));
  const completedRevenue = completedOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const primaryCurrency = data.finance?.acceptedCurrencies?.[0] || data.operations?.defaultCurrency || "USD";
  const recentOrders = [...activeOrders].slice(0, 5);
  const ActivityIcon = activityIcon(data.businessType);
  const activityLabel = data.archetype.nouns.activity[0].toUpperCase() + data.archetype.nouns.activity.slice(1);
  const capabilities = new Set(data.business?.capabilities || data.archetype.capabilities);
  const needsCatalog = ["catalog", "menu", "events", "services", "listings"].some((item) => capabilities.has(item));
  const hasKiosk = ["kiosk_pickup", "kiosk_ordering", "kiosk_checkin"].some((item) => capabilities.has(item));

  const actions = [
    needsCatalog && {
      icon: PackageCheck,
      title: activeProducts.length ? `Review ${data.archetype.nouns.items}` : `Add the first ${data.archetype.nouns.item}`,
      description: activeProducts.length ? `${activeProducts.length} active · ${unavailableProducts.length} unavailable` : `Use a relevant starter or create one ${data.archetype.nouns.item}.`,
      href: "/business/catalog",
      done: activeProducts.length > 0
    },
    {
      icon: UsersRound,
      title: data.members.length > 1 ? "Review who has access" : "Add the first teammate when ready",
      description: data.members.length > 1 ? `${data.members.length} people can access this business` : "Team setup is optional until another person needs to work here.",
      href: "/business/staff",
      done: data.members.length > 1
    },
    hasKiosk && {
      icon: ScanLine,
      title: data.business?.kiosk?.enabled ? "Review kiosk mode" : "Prepare a shared-device kiosk",
      description: data.business?.kiosk?.enabled ? "A focused shared-device experience is configured." : "Use a tablet for pickup or guest check-in without exposing settings.",
      href: "/business/kiosk",
      done: Boolean(data.business?.kiosk?.enabled)
    },
    {
      icon: MessageCircle,
      title: openSupport.length ? "Reply to Spotly Support" : "Get help without leaving the task",
      description: openSupport.length ? `${openSupport.length} open conversation${openSupport.length === 1 ? "" : "s"}` : "Open a conversation with the business and location already attached.",
      href: "/business/support",
      done: !openSupport.length
    }
  ].filter(Boolean);

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader eyebrow={data.archetype.shortLabel} title={data.business?.brandName || data.business?.name || "Business home"} description={`${data.selectedBranch?.branchName || data.selectedBranch?.name || data.selectedBranch?.displayName || "Main location"} · ${data.selectedBranch?.city || "Zimbabwe"}`} actions={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={data.business?.verificationStatus || "unverified"} />{data.business?.public ? <Badge tone="success">Visible to customers</Badge> : <Badge tone="neutral">Private setup</Badge>}</div>} /><WorkspaceContextSwitcher /></div>
    <CompletionBanner />
    <div className="metric-grid"><MetricCard label={`${activityLabel} needing action`} value={String(urgentOrders.length)} hint={urgentOrders.length ? "Open the current queue" : "Nothing waiting right now"} icon={ActivityIcon} tone={urgentOrders.length ? "warning" : "success"} /><MetricCard label="Completed value" value={formatCurrency(completedRevenue, primaryCurrency)} hint={`${completedOrders.length} completed`} icon={CircleDollarSign} />{needsCatalog && <MetricCard label={`Active ${data.archetype.nouns.items}`} value={String(activeProducts.length)} hint={unavailableProducts.length ? `${unavailableProducts.length} currently unavailable` : "Availability looks current"} icon={PackageCheck} tone={unavailableProducts.length ? "warning" : "default"} />}<MetricCard label="Open support" value={String(openSupport.length)} hint={openSupport.length ? "A reply may be needed" : "Support inbox is clear"} icon={MessageCircle} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><SectionCard title={activityLabel} description={`The most recent ${data.archetype.nouns.activity} that still need action`} action={<Link href="/business/activity"><Button size="sm" variant="outline">Open all<ArrowRight className="h-4 w-4" /></Button></Link>}>{recentOrders.length ? <div>{recentOrders.map((order) => <Link href={`/business/activity?order=${order.id}`} key={order.id} className="flex items-center gap-4 border-b p-4 last:border-0 hover:bg-[var(--surface-2)]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><ActivityIcon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{order.number || order.reference || order.id.slice(0, 8).toUpperCase()}</p><StatusBadge status={(order.status || "submitted").replaceAll("_", " ")} /></div><p className="mt-1 truncate text-sm text-secondary">{order.customerName || "Spotly customer"} · {order.items?.length || order.itemCount || 0} {data.archetype.nouns.items} · {order.branchName || data.selectedBranch?.branchName || data.selectedBranch?.name || "Location"}</p></div><div className="hidden text-right sm:block"><p className="font-bold">{formatCurrency(orderTotal(order), order.currency || primaryCurrency)}</p><p className="mt-1 text-xs text-tertiary">{relativeTime(order.createdAt)}</p></div><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <div className="flex flex-col items-center justify-center px-6 py-14 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-success"><CheckCircle2 className="h-6 w-6" /></span><h3 className="mt-4 text-lg font-bold">Nothing needs attention</h3><p className="mt-2 max-w-sm text-sm leading-6 text-secondary">New {data.archetype.nouns.activity} will appear here with one clear next action.</p></div>}</SectionCard><ReadinessCard compact /></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]"><SectionCard title="Recommended next actions" description="Spotly shows the most useful actions for this business and location"><div>{actions.map((item) => <Link href={item.href} key={item.title} className="flex items-center gap-3 border-b p-4 last:border-0 hover:bg-[var(--surface-2)]"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.done ? "bg-emerald-50 text-success" : "bg-business-soft text-business"}`}><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span>{item.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <ArrowRight className="h-4 w-4 text-tertiary" />}</Link>)}</div></SectionCard><Card className="relative overflow-hidden p-6"><div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-business-soft" /><div className="relative"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business text-white"><BarChart3 className="h-6 w-6" /></span><h2 className="mt-5 text-2xl font-black tracking-[-.035em]">A workspace shaped around {data.archetype.shortLabel.toLowerCase()}</h2><p className="mt-3 max-w-lg text-sm leading-7 text-secondary">Only relevant tools are visible. Business owners see the whole brand, while location-scoped staff see only assigned locations and responsibilities.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/business/setup"><Button className="w-full"><Sparkles className="h-4 w-4" />Review setup</Button></Link><Link href="/business/insights"><Button variant="outline" className="w-full"><BarChart3 className="h-4 w-4" />View insights</Button></Link></div></div></Card></div>
  </div>;
}
