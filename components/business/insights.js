"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  PackageCheck,
  TrendingUp,
  XCircle
} from "lucide-react";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, ProgressBar, SectionCard, Tabs } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher } from "@/components/business/shared";

const INSIGHT_MODELS = {
  grocery_retail: {
    record: "order",
    records: "orders",
    completed: ["picked_up", "completed"],
    cancelled: ["cancelled", "refunded"],
    readyStatus: "ready_for_pickup",
    acceptedStatuses: ["accepted", "preparing"],
    timeLabel: "Average preparation",
    timeHint: "Accepted to ready for pickup",
    completionLabel: "Pickup completion",
    empty: "Insights will appear as real pickup orders move through preparation and collection."
  },
  restaurant_food: {
    record: "order",
    records: "orders",
    completed: ["picked_up", "completed"],
    cancelled: ["cancelled", "refunded"],
    readyStatus: "ready_for_pickup",
    acceptedStatuses: ["accepted", "preparing"],
    timeLabel: "Average preparation",
    timeHint: "Accepted to ready for collection",
    completionLabel: "Collection completion",
    empty: "Insights will appear as food orders move through preparation and collection."
  },
  ticketing_events: {
    record: "ticket sale",
    records: "ticket sales",
    completed: ["issued", "checked_in", "completed"],
    cancelled: ["cancelled", "refunded", "void"],
    completionLabel: "Ticket fulfilment",
    empty: "Insights will appear when ticket sales, ticket issue, and check-in activity begin."
  },
  appointments_services: {
    record: "appointment",
    records: "appointments",
    completed: ["completed"],
    cancelled: ["cancelled", "no_show", "refunded"],
    completionLabel: "Appointment completion",
    empty: "Insights will appear as appointments are confirmed, attended, and completed."
  },
  accommodation_activities: {
    record: "booking",
    records: "bookings",
    completed: ["completed", "checked_out"],
    cancelled: ["cancelled", "refunded", "no_show"],
    completionLabel: "Booking completion",
    empty: "Insights will appear as bookings are confirmed, checked in, and completed."
  },
  directory_profile: {
    record: "enquiry",
    records: "enquiries",
    completed: ["resolved", "completed"],
    cancelled: ["closed", "spam"],
    completionLabel: "Enquiries resolved",
    empty: "Insights will appear after customers contact this business through its public profile."
  }
};

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function valueOf(record) {
  return Number(record.totals?.total ?? record.total ?? 0);
}

function withinDays(record, days) {
  if (days === "all") return true;
  const created = toDate(record.createdAt);
  return created ? created >= new Date(Date.now() - Number(days) * 86400000) : false;
}

function elapsedMinutes(record, model) {
  if (!model.readyStatus) return null;
  const timeline = record.timeline || [];
  const started = timeline.find((item) => model.acceptedStatuses?.includes(item.status));
  const ready = timeline.find((item) => item.status === model.readyStatus);
  if (!started?.at || !ready?.at) return null;
  const value = (new Date(ready.at).getTime() - new Date(started.at).getTime()) / 60000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function percentage(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function locationName(branch) {
  return branch?.branchName || branch?.name || branch?.displayName || "Selected location";
}

export function InsightsView() {
  const { orders, products, branches, finance, archetype, selectedBranch, selectedBranchId } = useBusinessWorkspace();
  const [range, setRange] = useState("30");
  const model = INSIGHT_MODELS[archetype.id] || INSIGHT_MODELS.directory_profile;
  const scopedRecords = useMemo(() => orders.filter((record) => !selectedBranchId || record.branchId === selectedBranchId), [orders, selectedBranchId]);
  const filtered = useMemo(() => scopedRecords.filter((record) => withinDays(record, range)), [scopedRecords, range]);
  const completed = filtered.filter((record) => model.completed.includes(record.status));
  const cancelled = filtered.filter((record) => model.cancelled.includes(record.status));
  const revenue = completed.reduce((sum, record) => sum + valueOf(record), 0);
  const currency = finance?.acceptedCurrencies?.[0] || filtered[0]?.currency || "USD";
  const average = completed.length ? revenue / completed.length : 0;
  const elapsedValues = completed.map((record) => elapsedMinutes(record, model)).filter((value) => value !== null);
  const averageElapsed = elapsedValues.length ? Math.round(elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length) : null;
  const activeOfferings = products.filter((item) => item.active);
  const unavailableOfferings = products.filter((item) => item.stockStatus === "unavailable" || item.availability === "unavailable");

  const locationPerformance = useMemo(() => {
    const map = new Map(branches.map((branch) => [branch.id, { id: branch.id, name: locationName(branch), records: 0, completed: 0, revenue: 0 }]));
    orders.filter((record) => withinDays(record, range)).forEach((record) => {
      const key = record.branchId || "unassigned";
      if (!map.has(key)) map.set(key, { id: key, name: record.branchName || "Unassigned location", records: 0, completed: 0, revenue: 0 });
      const item = map.get(key);
      item.records += 1;
      if (model.completed.includes(record.status)) {
        item.completed += 1;
        item.revenue += valueOf(record);
      }
    });
    return [...map.values()].filter((item) => item.records > 0).sort((a, b) => b.records - a.records);
  }, [branches, orders, range, model.completed]);

  const topOfferings = useMemo(() => {
    const map = new Map();
    filtered.forEach((record) => (record.items || []).forEach((line) => {
      const key = line.productId || line.offeringId || line.name;
      const current = map.get(key) || { id: key, name: line.name || "Offering", quantity: 0, value: 0 };
      current.quantity += Number(line.quantity || 1);
      current.value += Number(line.lineTotal ?? Number(line.unitPrice || 0) * Number(line.quantity || 1));
      map.set(key, current);
    }));
    return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [filtered]);

  const paymentMethods = useMemo(() => {
    const map = new Map();
    filtered.forEach((record) => map.set(record.paymentMethod || "not_recorded", (map.get(record.paymentMethod || "not_recorded") || 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  function exportCsv() {
    const header = ["reference", "created", "customer", "location", "status", "payment_method", "payment_status", "currency", "total"];
    const rows = filtered.map((record) => [record.number || record.reference || record.id, toDate(record.createdAt)?.toISOString() || "", record.customerName || "", record.branchName || "", record.status || "", record.paymentMethod || "", record.paymentStatus || "", record.currency || "", valueOf(record)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `spotly-${model.records.replaceAll(" ", "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const maxLocation = Math.max(1, ...locationPerformance.map((item) => item.records));
  const maxOffering = Math.max(1, ...topOfferings.map((item) => item.quantity));
  const hasPayments = filtered.some((record) => valueOf(record) > 0 || record.paymentMethod);
  const recordLabel = model.records[0].toUpperCase() + model.records.slice(1);
  const offeringLabel = archetype.nouns.items[0].toUpperCase() + archetype.nouns.items.slice(1);
  const locationLabel = archetype.nouns.branch === "venue" ? "Venue" : archetype.nouns.branch === "property" ? "Property" : "Location";

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <PageHeader title="Insights" description={`A clear view of real ${model.records}, customer value, and ${archetype.nouns.items} for ${locationName(selectedBranch)}.`} actions={<Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" />Export this view</Button>} />
      <BusinessSwitcher />
    </div>
    <Tabs value={range} onChange={setRange} tabs={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "all", label: "All time" }]} />

    <div className="metric-grid">
      <MetricCard label={`${recordLabel} received`} value={String(filtered.length)} hint={`${completed.length} completed`} icon={BarChart3} />
      <MetricCard label="Completed value" value={formatCurrency(revenue, currency)} hint={`Average ${formatCurrency(average, currency)}`} icon={TrendingUp} />
      <MetricCard label="Completion rate" value={`${percentage(completed.length, filtered.length)}%`} hint={`${cancelled.length} cancelled, refunded, or closed`} icon={CheckCircle2} tone={filtered.length && percentage(completed.length, filtered.length) < 80 ? "warning" : "success"} />
      {model.timeLabel ? <MetricCard label={model.timeLabel} value={averageElapsed === null ? "—" : `${averageElapsed} min`} hint={averageElapsed === null ? "Appears after completed timelines" : model.timeHint} icon={Clock3} /> : <MetricCard label="Active offerings" value={String(activeOfferings.length)} hint={`${products.length} total configured`} icon={PackageCheck} />}
      <MetricCard label={offeringLabel} value={String(activeOfferings.length)} hint={unavailableOfferings.length ? `${unavailableOfferings.length} unavailable` : "All available unless scheduled otherwise"} icon={PackageCheck} />
      <MetricCard label="Exception rate" value={`${percentage(cancelled.length, filtered.length)}%`} hint={cancelled.length ? `Review exceptions in ${model.records}` : "No exceptions in this period"} icon={XCircle} tone={cancelled.length ? "warning" : "success"} />
    </div>

    {!filtered.length ? <Card><EmptyState icon={BarChart3} title="Nothing to measure yet" description={model.empty} action={<Button variant="outline" href="/business/setup">Review setup</Button>} /></Card> : <>
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title={`${locationLabel} performance`} description={`Volume and completion across the business for the selected period.`}>
          <div className="p-5">{locationPerformance.length ? locationPerformance.map((item) => <div key={item.id} className="mb-5 last:mb-0"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.completed}/{item.records} completed{item.revenue ? ` · ${formatCurrency(item.revenue, currency)}` : ""}</p></div><Badge tone={percentage(item.completed, item.records) >= 85 ? "success" : "warning"}>{percentage(item.completed, item.records)}%</Badge></div><ProgressBar value={(item.records / maxLocation) * 100} className="mt-3" /></div>) : <p className="text-sm text-secondary">No location comparison is available yet.</p>}</div>
        </SectionCard>
        <SectionCard title={`Most selected ${archetype.nouns.items}`} description={`Quantity recorded across ${model.records} in this period.`}>
          <div className="p-5">{topOfferings.length ? topOfferings.map((item, index) => <div key={item.id} className="mb-5 last:mb-0"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-business-soft text-xs font-semibold text-business">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-secondary">{item.quantity} selected{item.value ? ` · ${formatCurrency(item.value, currency)}` : ""}</p></div></div></div><ProgressBar value={(item.quantity / maxOffering) * 100} className="mt-3" /></div>) : <p className="text-sm text-secondary">Detailed offering lines are not available for these records yet.</p>}</div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        {hasPayments ? <SectionCard title="Payment method mix"><div className="p-5">{paymentMethods.map((item) => <div key={item.name} className="flex items-center justify-between border-b py-3 last:border-0"><span className="text-sm font-semibold capitalize">{item.name.replaceAll("_", " ")}</span><span className="text-sm text-secondary">{item.count} · {percentage(item.count, filtered.length)}%</span></div>)}</div></SectionCard> : <SectionCard title="Payment information"><div className="p-5 text-sm leading-6 text-secondary">Payment breakdowns will appear when a transaction method is recorded for {model.records}.</div></SectionCard>}
        <Card className="p-6"><h2 className="text-lg font-bold">What to do next</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-grouped p-4"><p className="text-sm font-semibold">{model.completionLabel}</p><p className="mt-2 text-2xl font-semibold">{percentage(completed.length, filtered.length)}%</p><p className="mt-2 text-xs leading-5 text-secondary">Keep every open {model.record} in Spotly so the team sees the same next action and nothing is lost in messages or paper notes.</p></div><div className="rounded-2xl bg-grouped p-4"><p className="text-sm font-semibold">Data quality</p><p className="mt-2 text-2xl font-semibold">{filtered.length}</p><p className="mt-2 text-xs leading-5 text-secondary">Real records included in this view. Spotly never fills performance cards with invented activity.</p></div></div><p className="mt-5 text-xs leading-5 text-secondary">Use these signals for daily operations. Reconcile settlement and tax records in Payments before formal reporting.</p></Card>
      </div>
    </>}
  </div>;
}
