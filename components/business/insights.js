"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  PackageCheck,
  ShoppingBag,
  TrendingUp,
  XCircle
} from "lucide-react";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, ProgressBar, SectionCard, Tabs } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher } from "@/components/business/shared";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function total(order) {
  return Number(order.totals?.total ?? order.total ?? 0);
}

function withinDays(order, days) {
  if (days === "all") return true;
  const created = toDate(order.createdAt);
  return created ? created >= new Date(Date.now() - Number(days) * 86400000) : false;
}

function preparationMinutes(order) {
  const timeline = order.timeline || [];
  const accepted = timeline.find((item) => ["accepted", "preparing"].includes(item.status));
  const ready = timeline.find((item) => item.status === "ready_for_pickup");
  if (!accepted?.at || !ready?.at) return null;
  const value = (new Date(ready.at).getTime() - new Date(accepted.at).getTime()) / 60000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function percentage(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

export function InsightsView() {
  const { orders, products, branches, finance } = useBusinessWorkspace();
  const [range, setRange] = useState("30");
  const filtered = useMemo(() => orders.filter((order) => withinDays(order, range)), [orders, range]);
  const completed = filtered.filter((order) => ["picked_up", "completed"].includes(order.status));
  const cancelled = filtered.filter((order) => ["cancelled", "refunded"].includes(order.status));
  const revenue = completed.reduce((sum, order) => sum + total(order), 0);
  const currency = finance?.acceptedCurrencies?.[0] || filtered[0]?.currency || "USD";
  const average = completed.length ? revenue / completed.length : 0;
  const prepValues = completed.map(preparationMinutes).filter((value) => value !== null);
  const averagePrep = prepValues.length ? Math.round(prepValues.reduce((sum, value) => sum + value, 0) / prepValues.length) : null;

  const branchPerformance = useMemo(() => {
    const map = new Map(branches.map((branch) => [branch.id, { id: branch.id, name: branch.name, orders: 0, completed: 0, revenue: 0 }]));
    filtered.forEach((order) => {
      if (!map.has(order.branchId)) map.set(order.branchId || "unknown", { id: order.branchId || "unknown", name: order.branchName || "Unassigned branch", orders: 0, completed: 0, revenue: 0 });
      const item = map.get(order.branchId || "unknown");
      item.orders += 1;
      if (["picked_up", "completed"].includes(order.status)) { item.completed += 1; item.revenue += total(order); }
    });
    return [...map.values()].sort((a, b) => b.orders - a.orders);
  }, [branches, filtered]);

  const topProducts = useMemo(() => {
    const map = new Map();
    filtered.forEach((order) => (order.items || []).forEach((line) => {
      const key = line.productId || line.name;
      const current = map.get(key) || { id: key, name: line.name || "Product", quantity: 0, value: 0 };
      current.quantity += Number(line.quantity || 0);
      current.value += Number(line.lineTotal ?? Number(line.unitPrice || 0) * Number(line.quantity || 0));
      map.set(key, current);
    }));
    return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [filtered]);

  const paymentMethods = useMemo(() => {
    const map = new Map();
    filtered.forEach((order) => map.set(order.paymentMethod || "not_recorded", (map.get(order.paymentMethod || "not_recorded") || 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  function exportCsv() {
    const header = ["order", "created", "customer", "branch", "status", "payment_method", "payment_status", "currency", "total"];
    const rows = filtered.map((order) => [order.number || order.id, toDate(order.createdAt)?.toISOString() || "", order.customerName || "", order.branchName || "", order.status || "", order.paymentMethod || "", order.paymentStatus || "", order.currency || "", total(order)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `spotly-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const maxBranch = Math.max(1, ...branchPerformance.map((item) => item.orders));
  const maxProduct = Math.max(1, ...topProducts.map((item) => item.quantity));

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader title="Insights" description="Operational signals calculated from real orders, products, payments, and branches." actions={<Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" />Export orders</Button>} /><BusinessSwitcher /></div>
    <Tabs value={range} onChange={setRange} tabs={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "all", label: "All time" }]} />

    <div className="metric-grid">
      <MetricCard label="Orders received" value={String(filtered.length)} hint={`${completed.length} completed`} icon={ShoppingBag} />
      <MetricCard label="Completed order value" value={formatCurrency(revenue, currency)} hint={`Average ${formatCurrency(average, currency)}`} icon={TrendingUp} />
      <MetricCard label="Completion rate" value={`${percentage(completed.length, filtered.length)}%`} hint={`${cancelled.length} cancelled or refunded`} icon={CheckCircle2} tone={filtered.length && percentage(completed.length, filtered.length) < 80 ? "warning" : "success"} />
      <MetricCard label="Average preparation" value={averagePrep === null ? "—" : `${averagePrep} min`} hint={averagePrep === null ? "Appears after completed order timelines" : "Accepted to ready for pickup"} icon={Clock3} />
      <MetricCard label="Catalog coverage" value={String(products.filter((item) => item.active).length)} hint={`${products.filter((item) => item.stockStatus === "unavailable").length} unavailable`} icon={PackageCheck} />
      <MetricCard label="Cancellation rate" value={`${percentage(cancelled.length, filtered.length)}%`} hint={cancelled.length ? "Review reasons in order details" : "No cancellations in this period"} icon={XCircle} tone={cancelled.length ? "warning" : "success"} />
    </div>

    {!filtered.length ? <Card><EmptyState icon={BarChart3} title="Insights will appear after real activity" description="There are no orders in this date range. Spotly does not invent performance data; the dashboard will populate automatically as pickup orders move through the workflow." /></Card> : <>
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Branch performance" description="Order volume and completion by pickup branch">
          <div className="p-5">{branchPerformance.filter((item) => item.orders > 0).map((item) => <div key={item.id} className="mb-5 last:mb-0"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.completed}/{item.orders} completed · {formatCurrency(item.revenue, currency)}</p></div><Badge tone={percentage(item.completed, item.orders) >= 85 ? "success" : "warning"}>{percentage(item.completed, item.orders)}%</Badge></div><ProgressBar value={(item.orders / maxBranch) * 100} className="mt-3" /></div>)}</div>
        </SectionCard>
        <SectionCard title="Top ordered products" description="Quantity selected across orders in this date range">
          <div className="p-5">{topProducts.length ? topProducts.map((item, index) => <div key={item.id} className="mb-5 last:mb-0"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-business-soft text-xs font-black text-business">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.quantity} units · {formatCurrency(item.value, currency)}</p></div></div></div><ProgressBar value={(item.quantity / maxProduct) * 100} className="mt-3" /></div>) : <p className="text-sm text-secondary">Order line items are not available for this period.</p>}</div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <SectionCard title="Payment method mix"><div className="p-5">{paymentMethods.map((item) => <div key={item.name} className="flex items-center justify-between border-b py-3 last:border-0"><span className="text-sm font-semibold capitalize">{item.name.replaceAll("_", " ")}</span><span className="text-sm text-secondary">{item.count} · {percentage(item.count, filtered.length)}%</span></div>)}</div></SectionCard>
        <Card className="p-6"><h2 className="text-lg font-bold">Operational interpretation</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-grouped p-4"><p className="text-sm font-semibold">Pickup completion</p><p className="mt-2 text-2xl font-black">{percentage(completed.length, filtered.length)}%</p><p className="mt-2 text-xs leading-5 text-secondary">Aim to keep unresolved orders visible in the pickup queue rather than manually tracking them elsewhere.</p></div><div className="rounded-2xl bg-grouped p-4"><p className="text-sm font-semibold">Preparation visibility</p><p className="mt-2 text-2xl font-black">{prepValues.length}/{completed.length}</p><p className="mt-2 text-xs leading-5 text-secondary">Completed orders with enough timeline detail to calculate preparation time.</p></div></div><p className="mt-5 text-xs leading-5 text-secondary">Insights are operational guidance, not accounting statements. Reconcile payments and settlements in Finance before using totals for formal reporting.</p></Card>
      </div>
    </>}
  </div>;
}
