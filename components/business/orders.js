"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  MessageSquareText,
  PackageCheck,
  Phone,
  ShoppingBag,
  TicketCheck,
  UserRoundCheck,
  XCircle
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, TabPanel, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatCurrency } from "@/lib/format";
import { updateBusinessOrder } from "@/lib/business-services";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, ConfirmDialog, FieldLabel, FullScreenTask, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";

const FLOW = {
  grocery_retail: {
    singular: "order",
    plural: "orders",
    schedule: "Pickup",
    pending: ["new", "submitted", "accepted", "preparing", "awaiting_payment"],
    ready: ["ready_for_pickup"],
    complete: ["picked_up", "completed"],
    cancelled: ["cancelled", "refunded"],
    actions: {
      new: ["Accept order", "accepted"],
      submitted: ["Accept order", "accepted"],
      accepted: ["Start preparing", "preparing"],
      preparing: ["Mark ready", "ready_for_pickup"],
      ready_for_pickup: ["Complete pickup", "picked_up"]
    },
    empty: "New grocery pickup orders will appear here with one clear next action."
  },
  restaurant_food: {
    singular: "order",
    plural: "orders",
    schedule: "Collection",
    pending: ["new", "submitted", "accepted", "preparing", "awaiting_payment"],
    ready: ["ready_for_pickup"],
    complete: ["picked_up", "completed"],
    cancelled: ["cancelled", "refunded"],
    actions: {
      new: ["Accept order", "accepted"],
      submitted: ["Accept order", "accepted"],
      accepted: ["Start preparation", "preparing"],
      preparing: ["Mark ready", "ready_for_pickup"],
      ready_for_pickup: ["Complete collection", "picked_up"]
    },
    empty: "New food orders will appear here with preparation and collection steps."
  },
  ticketing_events: {
    singular: "ticket record",
    plural: "ticket sales",
    schedule: "Event",
    pending: ["submitted", "awaiting_payment", "payment_review", "confirmed"],
    ready: ["issued", "ready_for_checkin"],
    complete: ["checked_in", "completed"],
    cancelled: ["cancelled", "refunded", "void"],
    actions: {
      submitted: ["Confirm sale", "confirmed"],
      confirmed: ["Issue tickets", "issued"],
      issued: ["Check in guest", "checked_in"],
      ready_for_checkin: ["Check in guest", "checked_in"]
    },
    empty: "Ticket purchases and guest check-ins will appear here when events are live."
  },
  appointments_services: {
    singular: "appointment",
    plural: "appointments",
    schedule: "Appointment",
    pending: ["requested", "submitted", "confirmed", "awaiting_payment"],
    ready: ["arrived", "checked_in"],
    complete: ["completed"],
    cancelled: ["cancelled", "no_show", "refunded"],
    actions: {
      requested: ["Confirm appointment", "confirmed"],
      submitted: ["Confirm appointment", "confirmed"],
      confirmed: ["Check in customer", "checked_in"],
      arrived: ["Check in customer", "checked_in"],
      checked_in: ["Complete appointment", "completed"]
    },
    empty: "Appointment requests will appear here with confirmation, arrival, and completion steps."
  },
  accommodation_activities: {
    singular: "booking",
    plural: "bookings",
    schedule: "Booking",
    pending: ["requested", "submitted", "confirmed", "awaiting_payment"],
    ready: ["ready", "checked_in"],
    complete: ["completed", "checked_out"],
    cancelled: ["cancelled", "refunded", "no_show"],
    actions: {
      requested: ["Confirm booking", "confirmed"],
      submitted: ["Confirm booking", "confirmed"],
      confirmed: ["Mark ready", "ready"],
      ready: ["Check in", "checked_in"],
      checked_in: ["Complete booking", "completed"]
    },
    empty: "Booking requests will appear here with confirmation and arrival steps."
  },
  directory_profile: {
    singular: "enquiry",
    plural: "enquiries",
    schedule: "Received",
    pending: ["new", "open", "replied"],
    ready: [],
    complete: ["resolved", "completed"],
    cancelled: ["closed", "spam"],
    actions: {
      new: ["Open enquiry", "open"],
      open: ["Mark replied", "replied"],
      replied: ["Resolve enquiry", "resolved"]
    },
    empty: "Customer enquiries will appear here when the public profile is live."
  }
};

function flowFor(archetype) {
  return FLOW[archetype.id] || FLOW.directory_profile;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function reference(record) {
  return record.number || record.reference || record.ticketCode || record.bookingReference || record.id.slice(0, 8).toUpperCase();
}

function total(record) {
  return Number(record.totals?.total ?? record.total ?? 0);
}

function customerName(record) {
  return record.customerName || record.pickup?.contactName || record.appointment?.customerName || record.booking?.guestName || "Spotly customer";
}

function scheduleFor(record, flow) {
  const pickup = record.pickup || {};
  const appointment = record.appointment || {};
  const booking = record.booking || {};
  const event = record.event || {};
  const date = pickup.date || appointment.date || booking.startDate || event.date || record.scheduledDate || record.startsAt;
  const time = pickup.slot || appointment.time || booking.checkInTime || event.time || record.scheduledTime;
  return { label: flow.schedule, date: date || "Date pending", time: time || "Time pending" };
}

function groupFor(record, flow) {
  const status = record.status || "submitted";
  if (flow.ready.includes(status)) return "ready";
  if (flow.complete.includes(status)) return "completed";
  if (flow.cancelled.includes(status)) return "cancelled";
  return "active";
}

function nextAction(record, flow) {
  const status = record.status || "submitted";
  const action = flow.actions[status];
  return action ? { label: action[0], next: action[1] } : { label: `View ${flow.singular}`, next: null };
}

function PaymentBadge({ record }) {
  const status = record.paymentStatus || "not_recorded";
  const tone = ["paid", "settled"].includes(status) ? "success" : ["failed", "refunded"].includes(status) ? "danger" : "warning";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

function ActivityDetails({ record, open, onClose, user, products, archetype }) {
  const flow = flowFor(archetype);
  const isPickup = archetype.capabilities.includes("pickup_orders");
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [substitution, setSubstitution] = useState({ lineIndex: 0, replacementName: "", replacementPrice: "", quantity: 1 });
  const [task, setTask] = useState({ open: false, state: "processing", title: "", description: "", active: 0 });

  const recordId = record?.id || "";
  useEffect(() => {
    if (!recordId) return;
    setNote("");
    setSubstitution({ lineIndex: 0, replacementName: "", replacementPrice: "", quantity: 1 });
  }, [recordId]);

  if (!record) return null;
  const action = nextAction(record, flow);
  const scheduled = scheduleFor(record, flow);
  const created = dateValue(record.createdAt);
  const locationName = record.branchName || record.locationName || record.venueName || "Selected location";

  async function update(changes, message, eventNote = "") {
    setBusy(true);
    try {
      await updateBusinessOrder(record, changes, user, eventNote || message);
      toast(message, { title: `${flow.singular[0].toUpperCase()}${flow.singular.slice(1)} updated` });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not save the change" });
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    if (!action.next) return;
    setTask({ open: true, state: "processing", title: action.label, description: "Spotly is updating the record, activity history, and customer notifications.", active: 1 });
    try {
      await update({ status: action.next }, `${action.label} completed.`, note);
      setNote("");
      setTask({ open: true, state: "success", title: "Status updated", description: `This ${flow.singular} is now ${action.next.replaceAll("_", " ")}.`, active: 4 });
    } catch (error) {
      setTask({ open: true, state: "error", title: "The status was not changed", description: error.message, active: 1 });
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    const notes = [...(record.businessNotes || []), { body: note.trim(), at: new Date().toISOString(), actorId: user.uid, actorName: user.displayName || user.email }];
    await update({ businessNotes: notes }, "Team note saved.", note.trim());
    setNote("");
  }

  async function markPaid() {
    await update({ paymentStatus: "paid", paidAt: new Date().toISOString() }, "Payment marked as received.", `Payment confirmed for ${formatCurrency(total(record), record.currency || "USD")}.`);
  }

  async function cancelRecord() {
    await update({ status: "cancelled", cancellationReason: note || "Cancelled by business" }, `${flow.singular[0].toUpperCase()}${flow.singular.slice(1)} cancelled.`, note || "Cancelled by business");
    setCancelOpen(false);
    onClose();
  }

  async function saveSubstitution(event) {
    event.preventDefault();
    const line = record.items?.[Number(substitution.lineIndex)];
    if (!line || !substitution.replacementName.trim()) return;
    const entry = {
      originalProductId: line.productId || null,
      originalName: line.name,
      originalQuantity: line.quantity,
      replacementName: substitution.replacementName.trim(),
      replacementPrice: Number(substitution.replacementPrice || 0),
      quantity: Number(substitution.quantity || line.quantity || 1),
      status: "proposed",
      proposedAt: new Date().toISOString(),
      proposedBy: user.uid
    };
    await update({ substitutions: [...(record.substitutions || []), entry] }, `Substitution proposed for ${line.name}.`, `Suggested ${entry.replacementName} instead of ${line.name}.`);
    setSubstitutionOpen(false);
  }

  const detailIcon = archetype.id === "ticketing_events" ? TicketCheck : archetype.id === "appointments_services" ? UserRoundCheck : ShoppingBag;
  const DetailIcon = detailIcon;

  return <>
    <Modal open={open && !task.open} onClose={onClose} title={`${flow.singular[0].toUpperCase()}${flow.singular.slice(1)} ${reference(record)}`} size="xl">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
        <div className="border-b p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2"><StatusBadge status={(record.status || "submitted").replaceAll("_", " ")} /><PaymentBadge record={record} /></div><h2 className="mt-4 text-2xl font-semibold">{customerName(record)}</h2><p className="mt-2 text-sm text-secondary">Created {created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" }) : "recently"}</p></div><p className="text-2xl font-semibold">{total(record) > 0 ? formatCurrency(total(record), record.currency || "USD") : "—"}</p></div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-4 w-4 text-business" />{scheduled.label}</div><p className="mt-2 text-sm">{scheduled.date} · {scheduled.time}</p><p className="mt-1 text-xs text-secondary">{locationName}</p></div><div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2 text-sm font-bold"><Phone className="h-4 w-4 text-business" />Contact</div><p className="mt-2 text-sm">{record.customerPhone || record.pickup?.contactPhone || "No phone supplied"}</p><p className="mt-1 text-xs text-secondary">{record.customerEmail || "No email supplied"}</p></div></div>

          <SectionCard title={`${archetype.nouns.items[0].toUpperCase()}${archetype.nouns.items.slice(1)} (${record.items?.length || 0})`} className="mt-5"><div>{(record.items || []).length ? record.items.map((line, index) => <div key={`${line.productId || line.name}-${index}`} className="flex items-start gap-3 border-b p-4 last:border-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><DetailIcon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{line.quantity || 1} × {line.name}</p><p className="mt-1 text-xs text-secondary">{line.variant || line.ticketType || line.durationLabel || line.sku || "Standard"}</p></div><p className="font-semibold">{formatCurrency(line.lineTotal ?? Number(line.unitPrice || 0) * Number(line.quantity || 1), record.currency || "USD")}</p></div>) : <div className="p-5 text-sm text-secondary">This record does not contain item lines.</div>}</div></SectionCard>

          {record.substitutions?.length > 0 && <SectionCard title="Substitutions" className="mt-5"><div>{record.substitutions.map((item, index) => <div key={`${item.originalName}-${index}`} className="border-b p-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{item.originalName} → {item.replacementName}</p><StatusBadge status={item.status || "proposed"} /></div></div>)}</div></SectionCard>}
        </div>

        <div className="space-y-5 bg-grouped p-5">
          <Card className="p-5"><h3 className="font-bold">Recommended next action</h3><p className="mt-2 text-sm leading-6 text-secondary">The customer and activity history are updated when you continue.</p><Button className="mt-4 w-full" onClick={advance} loading={busy} disabled={!action.next || record.status === "awaiting_payment"}><ArrowRight className="h-4 w-4" />{action.label}</Button>{record.status === "awaiting_payment" && <p className="mt-3 rounded-xl bg-[var(--warning-soft)] p-3 text-xs leading-5 text-[var(--on-warning-soft)]">Continue after payment is confirmed or after the business accepts the configured pay-later method.</p>}</Card>

          <Card className="p-5"><h3 className="font-bold">Payment</h3><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-secondary">Method</span><span className="font-semibold capitalize">{(record.paymentMethod || "not recorded").replaceAll("_", " ")}</span></div><div className="flex justify-between"><span className="text-secondary">Status</span><PaymentBadge record={record} /></div><div className="flex justify-between"><span className="text-secondary">Total</span><span className="font-bold">{total(record) > 0 ? formatCurrency(total(record), record.currency || "USD") : "No charge"}</span></div></div>{!["paid", "settled", "refunded"].includes(record.paymentStatus) && total(record) > 0 && <Button variant="outline" className="mt-4 w-full" onClick={markPaid} loading={busy}><Banknote className="h-4 w-4" />Mark payment received</Button>}</Card>

          <Card className="p-5"><h3 className="font-bold">Team note</h3><p className="mt-2 text-xs leading-5 text-secondary">Notes remain with this record and are visible to authorized team members.</p><form onSubmit={addNote} className="mt-4 space-y-3"><textarea value={note} onChange={(event) => setNote(event.target.value)} className={textAreaClass} placeholder="Add a useful internal note" /><Button type="submit" variant="outline" className="w-full" disabled={!note.trim()} loading={busy}><MessageSquareText className="h-4 w-4" />Save note</Button></form></Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{isPickup && record.items?.length > 0 && <Button variant="outline" onClick={() => setSubstitutionOpen(true)} disabled={flow.complete.includes(record.status) || flow.cancelled.includes(record.status)}><PackageCheck className="h-4 w-4" />Substitution</Button>}<Button variant="danger" onClick={() => setCancelOpen(true)} disabled={flow.complete.includes(record.status) || flow.cancelled.includes(record.status)}><XCircle className="h-4 w-4" />Cancel</Button></div>

          {(record.pickup?.notes || record.customerNotes || record.notes) && <Card className="p-5"><h3 className="font-bold">Customer notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary">{record.pickup?.notes || record.customerNotes || record.notes}</p></Card>}
        </div>
      </div>
    </Modal>

    {isPickup && <Modal open={substitutionOpen} onClose={() => setSubstitutionOpen(false)} title="Propose a substitution" size="md"><form onSubmit={saveSubstitution} className="space-y-4 p-5"><FieldLabel label="Unavailable item" required><select value={substitution.lineIndex} onChange={(event) => setSubstitution({ ...substitution, lineIndex: Number(event.target.value), quantity: record.items?.[Number(event.target.value)]?.quantity || 1 })} className={selectClass}>{(record.items || []).map((line, index) => <option key={`${line.productId || line.name}-${index}`} value={index}>{line.quantity} × {line.name}</option>)}</select></FieldLabel><FieldLabel label="Suggested replacement" required><input required value={substitution.replacementName} onChange={(event) => setSubstitution({ ...substitution, replacementName: event.target.value })} className={fieldClass} list="product-suggestions" /><datalist id="product-suggestions">{products.filter((item) => item.active).map((item) => <option key={item.id} value={item.name} />)}</datalist></FieldLabel><div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Replacement price"><input type="number" min="0" step="0.01" value={substitution.replacementPrice} onChange={(event) => setSubstitution({ ...substitution, replacementPrice: event.target.value })} className={fieldClass} /></FieldLabel><FieldLabel label="Quantity"><input type="number" min="1" value={substitution.quantity} onChange={(event) => setSubstitution({ ...substitution, quantity: Number(event.target.value) })} className={fieldClass} /></FieldLabel></div><Button type="submit" className="w-full" loading={busy}>Save substitution</Button></form></Modal>}

    <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel this ${flow.singular}?`} description="The customer will be notified immediately. Add the reason in the team note field before confirming when useful." confirmLabel={`Cancel ${flow.singular}`} danger loading={busy} onConfirm={cancelRecord} />
    <FullScreenTask open={task.open} state={task.state} title={task.title} description={task.description} steps={["Validate the current status", "Update the record", "Write the activity history", "Notify the customer"]} activeStep={task.active} onDone={() => setTask((current) => ({ ...current, open: false }))} doneLabel="Return to activity" />
  </>;
}

export function OrdersView() {
  const { orders, products, user, archetype, selectedBranchId } = useBusinessWorkspace();
  const flow = flowFor(archetype);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialFilter = searchParams.get("status") || "active";
  const [filter, setFilter] = useState(initialFilter);
  const [queryText, setQueryText] = useState(searchParams.get("q") || "");
  const [selected, setSelected] = useState(null);

  function updateView(nextFilter = filter, nextQuery = queryText) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", nextFilter);
    if (nextQuery.trim()) params.set("q", nextQuery.trim()); else params.delete("q");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const nextFilter = searchParams.get("status") || "active";
    const nextQuery = searchParams.get("q") || "";
    setFilter(nextFilter);
    setQueryText(nextQuery);
    const recordId = searchParams.get("order") || searchParams.get("record");
    if (!recordId) return;
    const match = orders.find((item) => item.id === recordId);
    if (match) setSelected(match);
  }, [orders, searchParams]);

  const scoped = useMemo(() => orders.filter((record) => !selectedBranchId || !record.branchId || record.branchId === selectedBranchId), [orders, selectedBranchId]);
  const selectedRecord = selected ? orders.find((item) => item.id === selected.id) || selected : null;
  const visible = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    return scoped.filter((record) => filter === "all" || groupFor(record, flow) === filter).filter((record) => !term || [reference(record), customerName(record), record.customerEmail, record.customerPhone, record.branchName, record.status].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [scoped, filter, queryText, flow]);

  const counts = {
    active: scoped.filter((item) => groupFor(item, flow) === "active").length,
    ready: scoped.filter((item) => groupFor(item, flow) === "ready").length,
    completed: scoped.filter((item) => groupFor(item, flow) === "completed").length,
    cancelled: scoped.filter((item) => groupFor(item, flow) === "cancelled").length,
    all: scoped.length
  };
  const tabs = [
    { value: "active", label: `Needs action (${counts.active})` },
    ...(flow.ready.length ? [{ value: "ready", label: `Ready (${counts.ready})` }] : []),
    { value: "completed", label: `Completed (${counts.completed})` },
    { value: "cancelled", label: `Cancelled (${counts.cancelled})` },
    { value: "all", label: `All (${counts.all})` }
  ];
  const EmptyIcon = archetype.id === "ticketing_events" ? TicketCheck : archetype.id === "appointments_services" ? UserRoundCheck : CheckCircle2;

  function recordAge(record) {
    const created = record.createdAt?.toDate?.() || (record.createdAt ? new Date(record.createdAt) : null);
    if (!created || Number.isNaN(created.getTime())) return "Age unavailable";
    const minutes = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000));
    if (minutes < 60) return `${minutes} min old`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h old`;
    return `${Math.floor(minutes / 1440)} d old`;
  }

  function OrderCard({ record }) {
    const action = nextAction(record, flow);
    const scheduled = scheduleFor(record, flow);
    return <Card className="p-4" variant="bordered"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-tertiary">{reference(record)}</p><h3 className="mt-1 font-semibold">{customerName(record)}</h3><p className="mt-1 text-xs text-secondary">{recordAge(record)} · {record.items?.length || record.itemCount || 0} {archetype.nouns.items}</p></div><StatusBadge status={(record.status || "submitted").replaceAll("_", " ")} /></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[var(--surface-2)] p-3 text-sm"><div><p className="text-xs text-tertiary">{flow.schedule}</p><p className="mt-1 font-semibold">{scheduled.date} · {scheduled.time}</p></div><div><p className="text-xs text-tertiary">Payment</p><div className="mt-1"><PaymentBadge record={record} /></div></div><div><p className="text-xs text-tertiary">Location</p><p className="mt-1 truncate font-semibold">{record.branchName || record.locationName || "Selected location"}</p></div><div><p className="text-xs text-tertiary">Total</p><p className="mt-1 font-semibold">{total(record) > 0 ? formatCurrency(total(record), record.currency || "USD") : "—"}</p></div></div>{record.substitutionStatus && <div className="mt-3"><Badge tone={record.substitutionStatus === "required" ? "warning" : "neutral"}>Substitution {record.substitutionStatus.replaceAll("_", " ")}</Badge></div>}<Button className="mt-4 w-full" variant={action.next ? "primary" : "outline"} onClick={() => setSelected(record)}>{action.label}<ArrowRight className="h-4 w-4" /></Button></Card>;
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader title={archetype.nouns.activity[0].toUpperCase() + archetype.nouns.activity.slice(1)} description={`Handle ${flow.plural} for the selected ${archetype.nouns.branch}. Older and time-sensitive work stays visible.`} /><BusinessSwitcher /></div>
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><Tabs idPrefix="business-orders" controlsPanels value={filter} onChange={(next) => { setFilter(next); updateView(next, queryText); }} tabs={tabs} /><SearchField value={queryText} onChange={(next) => { setQueryText(next); window.clearTimeout(window.__spotlyOrderSearch); window.__spotlyOrderSearch = window.setTimeout(() => updateView(filter, next), 250); }} placeholder={`Reference, customer, ${archetype.nouns.branch}, or status`} className="w-full xl:max-w-md" /></div>
    <TabPanel idPrefix="business-orders" value={filter} active>
      {visible.length ? <><div className="grid gap-3 md:grid-cols-2 lg:hidden">{visible.map((record) => <OrderCard key={record.id} record={record} />)}</div><SectionCard className="hidden lg:block"> <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Age and {flow.schedule}</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((record) => { const action = nextAction(record, flow); const scheduled = scheduleFor(record, flow); return <tr key={record.id} className="border-t hover:bg-[var(--surface-2)]"><td className="px-5 py-4"><p className="font-semibold">{reference(record)}</p><p className="mt-1 text-xs text-secondary">{record.items?.length || record.itemCount || 0} {archetype.nouns.items}</p></td><td className="px-5 py-4"><p className="font-semibold">{customerName(record)}</p><p className="mt-1 text-xs text-secondary">{record.customerPhone || record.customerEmail || "No contact supplied"}</p></td><td className="px-5 py-4"><p className="font-semibold">{recordAge(record)}</p><p className="mt-1 text-xs text-secondary">{scheduled.date} · {scheduled.time}</p></td><td className="px-5 py-4"><PaymentBadge record={record} /></td><td className="px-5 py-4 font-semibold">{total(record) > 0 ? formatCurrency(total(record), record.currency || "USD") : "—"}</td><td className="px-5 py-4"><StatusBadge status={(record.status || "submitted").replaceAll("_", " ")} /></td><td className="px-5 py-4"><Button size="sm" variant={action.next ? "primary" : "outline"} onClick={() => setSelected(record)}>{action.label}<ArrowRight className="h-4 w-4" /></Button></td></tr>; })}</tbody></table></div></SectionCard></> : <EmptyState icon={EmptyIcon} title={queryText ? `No matching ${flow.plural}` : filter === "active" ? `No ${flow.plural} need attention` : `No ${filter} ${flow.plural}`} description={queryText ? "Try another reference, customer, location, or status." : flow.empty} />}
    </TabPanel>
    <ActivityDetails record={selectedRecord} open={Boolean(selectedRecord)} onClose={() => setSelected(null)} user={user} products={products} archetype={archetype} />
  </div>;
}
