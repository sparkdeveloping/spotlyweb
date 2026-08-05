"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  PackageCheck,
  Phone,
  ShoppingBag,
  XCircle
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, SearchField, SectionCard, StatusBadge, Tabs } from "@/components/ui";
import { useToast } from "@/components/providers";
import { formatCurrency } from "@/lib/format";
import { updateBusinessOrder } from "@/lib/business-services";
import { useBusinessWorkspace } from "@/components/business/business-context";
import { BusinessSwitcher, ConfirmDialog, FieldLabel, fieldClass, selectClass, textAreaClass } from "@/components/business/shared";

const terminalStatuses = ["picked_up", "completed", "cancelled", "refunded"];
const statusTabs = [
  { value: "active", label: "Needs action" },
  { value: "ready", label: "Ready for pickup" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All orders" }
];

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function orderTotal(order) {
  return Number(order.totals?.total ?? order.total ?? 0);
}

function reference(order) {
  return order.number || order.reference || order.id.slice(0, 8).toUpperCase();
}

function nextAction(order) {
  const status = order.status || "submitted";
  if (["awaiting_payment"].includes(status)) return { label: "Waiting for payment", next: null };
  if (["new", "submitted"].includes(status)) return { label: "Accept order", next: "accepted" };
  if (status === "accepted") return { label: "Start preparing", next: "preparing" };
  if (status === "preparing") return { label: "Mark ready", next: "ready_for_pickup" };
  if (status === "ready_for_pickup") return { label: "Complete pickup", next: "picked_up" };
  return { label: "Completed", next: null };
}

function matchesFilter(order, filter) {
  if (filter === "all") return true;
  if (filter === "ready") return order.status === "ready_for_pickup";
  if (filter === "completed") return ["picked_up", "completed"].includes(order.status);
  if (filter === "cancelled") return ["cancelled", "refunded"].includes(order.status);
  return !terminalStatuses.includes(order.status) && order.status !== "ready_for_pickup";
}

function PaymentBadge({ order }) {
  const status = order.paymentStatus || "not_recorded";
  const tone = ["paid", "settled"].includes(status) ? "success" : ["failed", "refunded"].includes(status) ? "danger" : "warning";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

function OrderDetails({ order, open, onClose, user, products }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [substitution, setSubstitution] = useState({ lineIndex: 0, replacementName: "", replacementPrice: "", quantity: 1 });
  const action = order ? nextAction(order) : { label: "", next: null };

  useEffect(() => {
    if (!order) return;
    setNote("");
    setSubstitution({ lineIndex: 0, replacementName: "", replacementPrice: "", quantity: 1 });
  }, [order?.id]);

  async function update(changes, message, eventNote = "") {
    setBusy(true);
    try {
      await updateBusinessOrder(order, changes, user, eventNote || message);
      toast(message, { title: "Order updated" });
    } catch (error) {
      toast(error.message, { type: "error", title: "Could not update order" });
    } finally { setBusy(false); }
  }

  async function advance() {
    if (!action.next) return;
    const labels = {
      accepted: "Order accepted. The customer has been notified.",
      preparing: "Preparation started.",
      ready_for_pickup: "Order marked ready for pickup.",
      picked_up: "Pickup completed successfully."
    };
    await update({ status: action.next }, labels[action.next], note);
    setNote("");
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    const notes = [...(order.businessNotes || []), { body: note.trim(), at: new Date().toISOString(), actorId: user.uid, actorName: user.displayName || user.email }];
    await update({ businessNotes: notes }, "Internal order note saved.", note.trim());
    setNote("");
  }

  async function markPaid() {
    await update({ paymentStatus: "paid", paidAt: new Date().toISOString() }, "Payment marked as received.", `Payment confirmed for ${formatCurrency(orderTotal(order), order.currency || "USD")}.`);
  }

  async function cancelOrder() {
    await update({ status: "cancelled", cancellationReason: note || "Cancelled by business" }, "Order cancelled. The customer has been notified.", note || "Cancelled by business");
    setCancelOpen(false);
    onClose();
  }

  async function saveSubstitution(event) {
    event.preventDefault();
    const line = order.items?.[Number(substitution.lineIndex)];
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
    await update({ substitutions: [...(order.substitutions || []), entry] }, `Substitution proposed for ${line.name}.`, `Suggested ${entry.replacementName} instead of ${line.name}.`);
    setSubstitutionOpen(false);
  }

  if (!order) return null;
  const created = dateValue(order.createdAt);
  const pickup = order.pickup || {};
  return <>
    <Modal open={open} onClose={onClose} title={`Order ${reference(order)}`} size="xl">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
        <div className="border-b p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={(order.status || "submitted").replaceAll("_", " ")} /><PaymentBadge order={order} /></div>
              <h2 className="mt-4 text-2xl font-black">{order.customerName || pickup.contactName || "Spotly customer"}</h2>
              <p className="mt-2 text-sm text-secondary">Created {created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "recently"}</p>
            </div>
            <p className="text-2xl font-black">{formatCurrency(orderTotal(order), order.currency || "USD")}</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4 text-business" />Pickup window</div><p className="mt-2 text-sm">{pickup.date || "Date pending"} · {pickup.slot || order.pickupWindow || "Time pending"}</p><p className="mt-1 text-xs text-secondary">{order.branchName || "Pickup branch"}</p></div>
            <div className="rounded-2xl bg-grouped p-4"><div className="flex items-center gap-2 text-sm font-bold"><Phone className="h-4 w-4 text-business" />Contact</div><p className="mt-2 text-sm">{pickup.contactPhone || order.customerPhone || "No phone supplied"}</p><p className="mt-1 text-xs text-secondary">{order.customerEmail || "No email supplied"}</p></div>
          </div>

          <SectionCard title={`Items (${order.items?.length || 0})`} className="mt-5">
            <div>{(order.items || []).map((line, index) => <div key={`${line.productId || line.name}-${index}`} className="flex items-start gap-3 border-b p-4 last:border-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-business-soft text-business"><ShoppingBag className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{line.quantity} × {line.name}</p><p className="mt-1 text-xs text-secondary">{line.sku ? `SKU ${line.sku}` : line.substitutionAllowed === false ? "No substitutions" : "Substitution allowed"}</p></div><p className="font-semibold">{formatCurrency(line.lineTotal ?? Number(line.unitPrice || 0) * Number(line.quantity || 0), order.currency || "USD")}</p></div>)}</div>
          </SectionCard>

          {order.substitutions?.length > 0 && <SectionCard title="Substitutions" description="Proposals remain attached to the order history" className="mt-5"><div>{order.substitutions.map((item, index) => <div key={`${item.originalName}-${index}`} className="border-b p-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{item.originalName} → {item.replacementName}</p><StatusBadge status={item.status || "proposed"} /></div><p className="mt-2 text-xs text-secondary">{item.quantity} × {formatCurrency(item.replacementPrice || 0, order.currency || "USD")}</p></div>)}</div></SectionCard>}
        </div>

        <div className="space-y-5 bg-grouped p-5">
          <Card className="p-5">
            <h3 className="font-bold">Next order action</h3>
            <p className="mt-2 text-sm leading-6 text-secondary">Spotly keeps the customer updated whenever the status changes.</p>
            <Button className="mt-4 w-full" onClick={advance} loading={busy} disabled={!action.next || order.status === "awaiting_payment"}>{action.next === "picked_up" ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}{action.label}</Button>
            {order.status === "awaiting_payment" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">This order will become actionable after Paynow confirms payment. For a verified manual payment, use “Mark payment received.”</p>}
          </Card>

          <Card className="p-5">
            <h3 className="font-bold">Payment</h3>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-secondary">Method</span><span className="font-semibold capitalize">{(order.paymentMethod || "not recorded").replaceAll("_", " ")}</span></div><div className="flex justify-between"><span className="text-secondary">Status</span><PaymentBadge order={order} /></div><div className="flex justify-between"><span className="text-secondary">Total</span><span className="font-bold">{formatCurrency(orderTotal(order), order.currency || "USD")}</span></div></div>
            {!['paid', 'settled', 'refunded'].includes(order.paymentStatus) && <Button variant="outline" className="mt-4 w-full" onClick={markPaid} loading={busy}><Banknote className="h-4 w-4" />Mark payment received</Button>}
          </Card>

          <Card className="p-5">
            <h3 className="font-bold">Order note</h3>
            <p className="mt-2 text-xs leading-5 text-secondary">Notes are visible to your team and added to the order activity trail.</p>
            <form onSubmit={addNote} className="mt-4 space-y-3"><textarea value={note} onChange={(event) => setNote(event.target.value)} className={textAreaClass} placeholder="Example: Customer confirmed the replacement brand by phone." /><Button type="submit" variant="outline" className="w-full" disabled={!note.trim()} loading={busy}><MessageSquareText className="h-4 w-4" />Save note</Button></form>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Button variant="outline" onClick={() => setSubstitutionOpen(true)} disabled={!order.items?.length || terminalStatuses.includes(order.status)}><PackageCheck className="h-4 w-4" />Propose substitution</Button>
            <Button variant="danger" onClick={() => setCancelOpen(true)} disabled={terminalStatuses.includes(order.status)}><XCircle className="h-4 w-4" />Cancel order</Button>
          </div>

          {pickup.notes && <Card className="p-5"><h3 className="font-bold">Customer notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary">{pickup.notes}</p></Card>}
          <Card className="p-5"><h3 className="font-bold">Substitution preference</h3><p className="mt-2 text-sm capitalize text-secondary">{(pickup.substitutionPreference || "contact_me").replaceAll("_", " ")}</p></Card>
        </div>
      </div>
    </Modal>

    <Modal open={substitutionOpen} onClose={() => setSubstitutionOpen(false)} title="Propose a substitution" size="md">
      <form onSubmit={saveSubstitution} className="space-y-4 p-5">
        <FieldLabel label="Unavailable item" required><select value={substitution.lineIndex} onChange={(event) => setSubstitution({ ...substitution, lineIndex: Number(event.target.value), quantity: order.items?.[Number(event.target.value)]?.quantity || 1 })} className={selectClass}>{(order.items || []).map((line, index) => <option key={`${line.productId || line.name}-${index}`} value={index}>{line.quantity} × {line.name}</option>)}</select></FieldLabel>
        <FieldLabel label="Suggested replacement" required hint="Use the exact product name the customer will recognize."><input required value={substitution.replacementName} onChange={(event) => setSubstitution({ ...substitution, replacementName: event.target.value })} className={fieldClass} list="product-suggestions" /><datalist id="product-suggestions">{products.filter((item) => item.active).map((item) => <option key={item.id} value={item.name} />)}</datalist></FieldLabel>
        <div className="grid gap-4 sm:grid-cols-2"><FieldLabel label="Replacement price"><input type="number" min="0" step="0.01" value={substitution.replacementPrice} onChange={(event) => setSubstitution({ ...substitution, replacementPrice: event.target.value })} className={fieldClass} /></FieldLabel><FieldLabel label="Quantity"><input type="number" min="1" value={substitution.quantity} onChange={(event) => setSubstitution({ ...substitution, quantity: Number(event.target.value) })} className={fieldClass} /></FieldLabel></div>
        <div className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">The customer will see the substitution in the order history and receive a notification. Do not complete pickup until the substitution is resolved according to their preference.</div>
        <Button type="submit" className="w-full" loading={busy}>Save substitution</Button>
      </form>
    </Modal>

    <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?" description="The customer will be notified immediately. Add the cancellation reason in the order note field before confirming when possible." confirmLabel="Cancel order" danger loading={busy} onConfirm={cancelOrder} />
  </>;
}

export function OrdersView() {
  const { orders, products, user } = useBusinessWorkspace();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const orderId = searchParams.get("order");
    if (orderId) {
      const match = orders.find((item) => item.id === orderId);
      if (match) setSelected(match);
    }
  }, [orders, searchParams]);

  const selectedOrder = selected ? orders.find((item) => item.id === selected.id) || selected : null;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => matchesFilter(order, filter)).filter((order) => !term || [reference(order), order.customerName, order.customerEmail, order.customerPhone, order.branchName, order.status].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [orders, filter, query]);

  const counts = {
    active: orders.filter((item) => matchesFilter(item, "active")).length,
    ready: orders.filter((item) => matchesFilter(item, "ready")).length,
    completed: orders.filter((item) => matchesFilter(item, "completed")).length,
    cancelled: orders.filter((item) => matchesFilter(item, "cancelled")).length,
    all: orders.length
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><PageHeader title="Orders & pickup" description="Accept, prepare, substitute, collect payment, and complete grocery pickup orders." /><BusinessSwitcher /></div>
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><Tabs value={filter} onChange={setFilter} tabs={statusTabs.map((tab) => ({ ...tab, label: `${tab.label} (${counts[tab.value]})` }))} /><SearchField value={query} onChange={setQuery} placeholder="Order number, customer, branch, or status" className="w-full xl:max-w-md" /></div>
    <SectionCard>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-tertiary"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Pickup</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody>{visible.map((order) => { const action = nextAction(order); return <tr key={order.id} className="border-t hover:bg-[var(--surface-2)]"><td className="px-5 py-4"><p className="font-bold">{reference(order)}</p><p className="mt-1 text-xs text-secondary">{order.items?.length || order.itemCount || 0} items</p></td><td className="px-5 py-4"><p className="font-semibold">{order.customerName || order.pickup?.contactName || "Spotly customer"}</p><p className="mt-1 text-xs text-secondary">{order.pickup?.contactPhone || order.customerEmail || "No contact supplied"}</p></td><td className="px-5 py-4"><p className="font-semibold">{order.pickup?.date || "Date pending"} · {order.pickup?.slot || order.pickupWindow || "Time pending"}</p><p className="mt-1 text-xs text-secondary">{order.branchName || "Pickup branch"}</p></td><td className="px-5 py-4"><PaymentBadge order={order} /><p className="mt-2 text-xs capitalize text-secondary">{(order.paymentMethod || "not recorded").replaceAll("_", " ")}</p></td><td className="px-5 py-4 font-bold">{formatCurrency(orderTotal(order), order.currency || "USD")}</td><td className="px-5 py-4"><StatusBadge status={(order.status || "submitted").replaceAll("_", " ")} /></td><td className="px-5 py-4"><Button size="sm" variant={action.next ? "primary" : "outline"} onClick={() => setSelected(order)}>{action.next ? action.label : "View order"}<ArrowRight className="h-4 w-4" /></Button></td></tr>; })}</tbody></table></div> : <EmptyState icon={filter === "active" ? CheckCircle2 : ShoppingBag} title={query ? "No matching orders" : filter === "active" ? "No orders need attention" : `No ${filter} orders`} description={query ? "Try another order number, customer name, branch, or status." : "Orders will move into this view automatically as customers and your team update them."} />}
    </SectionCard>
    <OrderDetails order={selectedOrder} open={Boolean(selectedOrder)} onClose={() => setSelected(null)} user={user} products={products} />
  </div>;
}
