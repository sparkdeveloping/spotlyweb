"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  UsersRound
} from "lucide-react";
import { Badge, Button, Card, MetricCard, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, CompletionBanner, ReadinessCard } from "@/components/business/shared";

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

export function BusinessDashboard() {
  const data = useBusinessWorkspace();
  const activeOrders = data.orders.filter((order) => !["picked_up", "completed", "cancelled", "refunded"].includes(order.status));
  const urgentOrders = activeOrders.filter((order) => ["submitted", "new", "accepted", "preparing"].includes(order.status));
  const activeProducts = data.products.filter((product) => product.active);
  const unavailableProducts = data.products.filter((product) => product.active && ["unavailable", "out_of_stock"].includes(product.stockStatus));
  const openSupport = data.support.filter((item) => !["closed", "resolved"].includes(item.status));
  const completedOrders = data.orders.filter((order) => ["picked_up", "completed"].includes(order.status));
  const completedRevenue = completedOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const primaryCurrency = data.finance?.acceptedCurrencies?.[0] || data.operations?.defaultCurrency || "USD";
  const recentOrders = [...activeOrders].slice(0, 5);

  const actions = [
    {
      icon: data.branches.length ? MapPin : Building2,
      title: data.branches.length ? "Review branch pickup hours" : "Add your first branch",
      description: data.branches.length ? `${data.branches.length} branch${data.branches.length === 1 ? "" : "es"} connected` : "Add the address, contact, hours, and pickup capacity.",
      href: "/business/branches",
      done: data.branches.some((branch) => branch.status === "active" && branch.address && branch.phone)
    },
    {
      icon: activeProducts.length ? PackageCheck : BookOpenCheck,
      title: activeProducts.length ? "Keep product availability accurate" : "Build your pickup catalog",
      description: activeProducts.length ? `${activeProducts.length} active · ${unavailableProducts.length} unavailable` : "Start from a grocery template or add products quickly.",
      href: "/business/catalog",
      done: activeProducts.length >= 5
    },
    {
      icon: data.members.length > 1 ? UsersRound : UsersRound,
      title: data.members.length > 1 ? "Review team permissions" : "Invite the people who will run pickup",
      description: `${data.members.length} active member${data.members.length === 1 ? "" : "s"} · ${data.invitations.filter((item) => item.status === "pending").length} pending invite${data.invitations.filter((item) => item.status === "pending").length === 1 ? "" : "s"}`,
      href: "/business/staff",
      done: data.members.length > 1 || data.invitations.some((item) => ["pending", "accepted"].includes(item.status))
    },
    {
      icon: data.finance ? CircleDollarSign : CircleDollarSign,
      title: data.finance ? "Confirm payout and tax information" : "Configure payments and payouts",
      description: data.finance?.paymentMethods?.length ? `${data.finance.paymentMethods.length} payment methods selected` : "Select USD, ZiG, Paynow, mobile money, card, cash, and bank transfer.",
      href: "/business/finance",
      done: Boolean(data.finance?.paymentMethods?.length && data.finance?.payoutCadence)
    }
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <PageHeader
        eyebrow="Spotly Business"
        title={data.business?.name || "Business dashboard"}
        description={`${data.business?.category || "Business"} · ${data.business?.city || "Zimbabwe"} · Live operational workspace`}
        actions={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={data.business?.verificationStatus || "unverified"} />{data.business?.public ? <Badge tone="success">Public listing</Badge> : <Badge tone="neutral">Private setup</Badge>}</div>}
      />
      <BusinessSwitcher />
    </div>

    <CompletionBanner />

    <div className="metric-grid">
      <MetricCard label="Orders needing action" value={String(urgentOrders.length)} hint={urgentOrders.length ? "Open the pickup queue" : "Nothing waiting right now"} icon={ShoppingBag} tone={urgentOrders.length ? "warning" : "success"} />
      <MetricCard label="Completed order value" value={formatCurrency(completedRevenue, primaryCurrency)} hint={`${completedOrders.length} completed pickup${completedOrders.length === 1 ? "" : "s"}`} icon={CircleDollarSign} />
      <MetricCard label="Active catalog items" value={String(activeProducts.length)} hint={unavailableProducts.length ? `${unavailableProducts.length} currently unavailable` : "Availability looks current"} icon={BookOpenCheck} tone={unavailableProducts.length ? "warning" : "default"} />
      <MetricCard label="Open support" value={String(openSupport.length)} hint={openSupport.length ? "Replies or review may be needed" : "Support inbox is clear"} icon={MessageCircle} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <SectionCard title="Pickup queue" description="The most recent orders that still need business action" action={<Link href="/business/activity"><Button size="sm" variant="outline">Open all orders<ArrowRight className="h-4 w-4" /></Button></Link>}>
        {recentOrders.length ? <div>{recentOrders.map((order) => <Link href={`/business/activity?order=${order.id}`} key={order.id} className="flex items-center gap-4 border-b p-4 last:border-0 hover:bg-[var(--surface-2)]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><ShoppingBag className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{order.number || order.reference || order.id.slice(0, 8).toUpperCase()}</p><StatusBadge status={(order.status || "submitted").replaceAll("_", " ")} /></div><p className="mt-1 truncate text-sm text-secondary">{order.customerName || "Spotly customer"} · {order.items?.length || order.itemCount || 0} items · {order.branchName || "Pickup branch"}</p></div><div className="hidden text-right sm:block"><p className="font-bold">{formatCurrency(orderTotal(order), order.currency || primaryCurrency)}</p><p className="mt-1 text-xs text-tertiary">{relativeTime(order.createdAt)}</p></div><ArrowRight className="h-4 w-4 text-tertiary" /></Link>)}</div> : <div className="flex flex-col items-center justify-center px-6 py-14 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-success"><CheckCircle2 className="h-6 w-6" /></span><h3 className="mt-4 text-lg font-bold">Pickup queue is clear</h3><p className="mt-2 max-w-sm text-sm leading-6 text-secondary">New customer orders will appear here immediately with one clear next action.</p></div>}
      </SectionCard>
      <ReadinessCard compact />
    </div>

    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <SectionCard title="Recommended next actions" description="Spotly prioritizes the work that makes the business launch-ready">
        <div>{actions.map((item) => <Link href={item.href} key={item.title} className="flex items-center gap-3 border-b p-4 last:border-0 hover:bg-[var(--surface-2)]"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.done ? "bg-emerald-50 text-success" : "bg-business-soft text-business"}`}><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-secondary">{item.description}</span></span>{item.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <ArrowRight className="h-4 w-4 text-tertiary" />}</Link>)}</div>
      </SectionCard>
      <Card className="relative overflow-hidden p-6">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-business-soft" />
        <div className="relative">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-business text-white"><Sparkles className="h-6 w-6" /></span>
          <h2 className="mt-5 text-2xl font-black tracking-[-.035em]">90% prepared by Spotly. 10% confirmed by your team.</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-secondary">Templates, useful defaults, branch copying, clear readiness checks, automatic totals, and contextual support reduce repetitive setup. Your team confirms only the details Spotly cannot know.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/business/catalog"><Button className="w-full"><BookOpenCheck className="h-4 w-4" />Use a catalog template</Button></Link>
            <Link href="/business/support"><Button variant="outline" className="w-full"><MessageCircle className="h-4 w-4" />Ask for setup help</Button></Link>
          </div>
        </div>
      </Card>
    </div>
  </div>;
}
