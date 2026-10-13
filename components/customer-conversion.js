"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBasket,
  Ticket,
  UsersRound
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";

function offerPrice(product, currency) {
  const raw = product?.prices?.[currency] ?? (product?.currency === currency || !product?.currency ? product?.price : undefined);
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function tomorrowDate() {
  const value = new Date(Date.now() + 86_400_000);
  return value.toISOString().slice(0, 10);
}

function checkoutId() {
  try { return crypto.randomUUID().replaceAll("-", "_"); } catch { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }
}

function eventDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function OfferDetailModal({
  product,
  open,
  onClose,
  currency,
  archetype,
  quantity = 0,
  onQuantityChange,
  onBook,
  branch
}) {
  if (!product) return null;
  const price = offerPrice(product, currency);
  const pickup = archetype?.capabilities?.includes("pickup_orders");
  const event = archetype?.id === "ticketing_events";
  const appointment = archetype?.id === "appointments_services";
  const booking = archetype?.id === "accommodation_activities";
  const transactable = event || appointment || booking;
  const starts = eventDate(product.startsAt);
  const unavailable = product.available === false || product.active === false || product.stockStatus === "out_of_stock";
  const remaining = event && Number(product.capacity || 0) > 0 ? Math.max(0, Number(product.remainingCapacity ?? product.capacity ?? 0)) : null;

  const cta = event ? "Get tickets" : appointment ? "Request appointment" : booking ? "Request booking" : "View business details";

  return (
    <Modal open={open} onClose={onClose} title={product.name} description={branch?.branchName || branch?.name || archetype?.shortLabel || "Spotly"} size="lg">
      <div className="grid gap-0 md:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <div className="relative min-h-[240px] overflow-hidden bg-[var(--surface-2)] md:min-h-[520px]">
          {product.image ? <Image src={product.image} alt={product.name} fill unoptimized className="object-cover" sizes="(max-width: 768px) 100vw, 45vw" /> : <div className="flex h-full min-h-[240px] items-center justify-center text-[var(--text-3)]"><ShoppingBasket className="h-14 w-14" /></div>}
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="neutral">{product.category || archetype?.shortLabel || "Offering"}</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em]">{product.name}</h2>
            </div>
            <p className={cn("text-xl font-semibold", price === null && "text-warning")}>{price === null ? `No ${currency} price` : price === 0 ? "Free" : formatCurrency(price, currency)}</p>
          </div>

          {product.description ? <p className="mt-5 text-sm leading-7 text-[var(--text-2)]">{product.description}</p> : null}

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {event && starts ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><CalendarDays className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">EVENT</p><p className="mt-1 text-sm font-semibold">{starts.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" })}</p></div> : null}
            {event && product.venue ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><MapPin className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">VENUE</p><p className="mt-1 text-sm font-semibold">{product.venue}</p></div> : null}
            {appointment ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><Clock3 className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">DURATION</p><p className="mt-1 text-sm font-semibold">{Number(product.durationMinutes || 30)} minutes</p></div> : null}
            {booking && Number(product.capacity || 0) > 0 ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><UsersRound className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">CAPACITY</p><p className="mt-1 text-sm font-semibold">Up to {Number(product.capacity)} people</p></div> : null}
            {event && remaining !== null ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><Ticket className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">AVAILABILITY</p><p className="mt-1 text-sm font-semibold">{remaining > 0 ? `${remaining} remaining` : "Sold out"}</p></div> : null}
            {(product.unit || product.packSize || product.variant) ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><PackageCheck className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">DETAILS</p><p className="mt-1 text-sm font-semibold">{[product.variant, product.packSize, product.unit].filter(Boolean).join(" · ")}</p></div> : null}
          </div>

          {pickup ? (
            <div className="mt-7 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div><p className="font-semibold">Add to basket</p><p className="mt-1 text-xs text-[var(--text-3)]">Pickup and delivery options are confirmed at checkout.</p></div>
                {quantity > 0 ? <div className="flex items-center rounded-xl border bg-[var(--surface)] p-1"><button type="button" onClick={() => onQuantityChange(product, quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"><Minus className="h-4 w-4" /></button><span className="w-9 text-center text-sm font-semibold">{quantity}</span><button type="button" disabled={unavailable || price === null} onClick={() => onQuantityChange(product, quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-40"><Plus className="h-4 w-4" /></button></div> : <Button disabled={unavailable || price === null} onClick={() => onQuantityChange(product, 1)}><Plus className="h-4 w-4" />Add</Button>}
              </div>
            </div>
          ) : transactable ? (
            <div className="mt-7">
              <Button className="w-full" disabled={unavailable || (event && remaining === 0)} onClick={() => onBook(product)}>{event ? <Ticket className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}{cta}</Button>
              <p className="mt-3 text-center text-xs leading-5 text-[var(--text-3)]">Spotly sends the request directly to this business and keeps its status in Activity.</p>
            </div>
          ) : (
            <div className="mt-7 rounded-[18px] bg-[var(--surface-2)] p-4">
              <p className="font-semibold">Available from this business</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">This listing is informational right now. Use the business page for its published location and contact details.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function CustomerTransactionModal({ open, onClose, product, business, branches = [], selectedBranchId, currency, user, archetype, onComplete }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    checkoutId: "",
    branchId: selectedBranchId || "",
    quantity: 1,
    contactName: user?.displayName || "",
    contactPhone: user?.phoneNumber || "",
    notes: "",
    date: tomorrowDate(),
    time: "10:00",
    startDate: tomorrowDate(),
    endDate: tomorrowDate(),
    guests: 1,
    paymentMethod: "pay_later"
  });

  const kind = archetype?.id === "ticketing_events" ? "ticket" : archetype?.id === "appointments_services" ? "appointment" : "booking";
  const price = offerPrice(product, currency) ?? 0;
  const total = price * (kind === "ticket" ? Number(form.quantity || 1) : 1);
  const ticketLimit = kind === "ticket" ? Math.max(0, Math.min(Number(product?.maxQuantity || 10), Number(product?.remainingCapacity ?? product?.capacity ?? product?.maxQuantity ?? 10))) : 1;
  const branch = useMemo(() => branches.find((item) => item.id === form.branchId) || branches.find((item) => item.id === selectedBranchId) || branches[0] || null, [branches, form.branchId, selectedBranchId]);

  useEffect(() => {
    if (!open || !product) return;
    const defaultPayment = kind === "ticket" && price > 0 ? "paynow" : "pay_later";
    setError("");
    setSuccess(null);
    setForm({
      checkoutId: checkoutId(),
      branchId: selectedBranchId || branches[0]?.id || "",
      quantity: 1,
      contactName: user?.displayName || "",
      contactPhone: user?.phoneNumber || "",
      notes: "",
      date: tomorrowDate(),
      time: "10:00",
      startDate: tomorrowDate(),
      endDate: tomorrowDate(),
      guests: 1,
      paymentMethod: defaultPayment
    });
  }, [open, product?.id, selectedBranchId, user?.displayName, user?.phoneNumber, kind, price, branches]);

  if (!product) return null;

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  function validate() {
    if (!form.branchId) return "Choose a business location.";
    if (form.contactName.trim().length < 2) return "Add the customer name.";
    if (form.contactPhone.trim().length < 7) return "Add a phone number the business can use.";
    if (kind === "ticket" && ticketLimit < 1) return "This event is sold out.";
    if (kind === "ticket" && Number(form.quantity || 1) > ticketLimit) return `Choose up to ${ticketLimit} ticket${ticketLimit === 1 ? "" : "s"}.`;
    if (kind === "appointment" && (!form.date || !form.time)) return "Choose an appointment date and time.";
    if (kind === "booking" && !form.startDate) return "Choose a booking date.";
    return "";
  }

  async function submit() {
    const message = validate();
    if (message) { setError(message); return; }
    if (!user || user.isAnonymous) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        checkoutId: form.checkoutId,
        businessId: business.id,
        branchId: form.branchId,
        itemId: product.id,
        quantity: kind === "ticket" ? Number(form.quantity || 1) : 1,
        currency,
        paymentMethod: form.paymentMethod,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        notes: form.notes.trim(),
        ...(kind === "appointment" ? { appointment: { date: form.date, time: form.time } } : {}),
        ...(kind === "booking" ? { booking: { startDate: form.startDate, endDate: form.endDate || form.startDate, guests: Number(form.guests || 1) } } : {})
      };
      const result = await authenticatedFetch("/api/customer/transactions/create", { method: "POST", body: JSON.stringify(payload) });
      if (result.paymentRequired && form.paymentMethod === "paynow") {
        const payment = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: result.orderId, channel: "web" }) });
        onComplete?.(result);
        if (payment.redirectUrl) {
          window.location.assign(payment.redirectUrl);
          return;
        }
      }
      setSuccess(result);
      onComplete?.(result);
      toast(kind === "ticket" ? "Ticket request created." : kind === "appointment" ? "Appointment request sent." : "Booking request sent.", { type: "success", title: "Added to Activity" });
    } catch (reason) {
      setError(reason.message || "The request could not be created. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = kind === "ticket" ? "Get tickets" : kind === "appointment" ? "Request an appointment" : "Request a booking";
  const description = kind === "ticket" ? "Choose tickets and contact details." : "Spotly will send the request to the business for confirmation.";

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="lg">
      {success ? <div className="p-6 sm:p-8"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><Check className="h-8 w-8" /></div><div className="mx-auto mt-5 max-w-lg text-center"><h3 className="text-2xl font-semibold tracking-[-.035em]">It’s in Activity</h3><p className="mt-3 text-sm leading-7 text-[var(--text-2)]">Reference <strong>{success.number}</strong>. {kind === "ticket" ? "The ticket sale is ready for payment or confirmation." : "The business can now review and confirm your request."}</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={() => { onClose(); }}>Done</Button><Button variant="outline" onClick={() => window.location.assign(`/?view=activity&order=${encodeURIComponent(success.orderId)}`)}>Open Activity</Button></div></div></div> : <>
        <div className="space-y-5 p-5 sm:p-6">
          {error ? <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div> : null}

          <div className="flex gap-4 rounded-[18px] bg-[var(--surface-2)] p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-[var(--surface)]">{product.image ? <Image src={product.image} alt="" fill unoptimized className="object-cover" sizes="64px" /> : <div className="flex h-full items-center justify-center"><Ticket className="h-6 w-6 text-[var(--text-3)]" /></div>}</div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{product.name}</p><p className="mt-1 text-xs text-[var(--text-3)]">{business?.name}{branch ? ` · ${branch.branchName || branch.name}` : ""}</p><p className="mt-2 text-sm font-semibold">{price === 0 ? "Free" : formatCurrency(total, currency)}</p></div>
          </div>

          {branches.length > 1 ? <label className="block text-sm font-medium">Location<select className="field-control mt-2" value={form.branchId} onChange={(event) => update("branchId", event.target.value)}>{branches.map((item) => <option key={item.id} value={item.id}>{item.branchName || item.name} · {item.city || "Zimbabwe"}</option>)}</select></label> : null}

          {kind === "ticket" ? <div><p className="text-sm font-medium">Tickets</p><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => update("quantity", Math.max(1, Number(form.quantity) - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border"><Minus className="h-4 w-4" /></button><span className="w-10 text-center text-lg font-semibold">{form.quantity}</span><button type="button" disabled={ticketLimit < 1 || Number(form.quantity) >= ticketLimit} onClick={() => update("quantity", Math.min(ticketLimit, Number(form.quantity) + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button></div></div> : null}

          {kind === "appointment" ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Date<input type="date" min={tomorrowDate()} className="field-control mt-2" value={form.date} onChange={(event) => update("date", event.target.value)} /></label><label className="text-sm font-medium">Preferred time<input type="time" className="field-control mt-2" value={form.time} onChange={(event) => update("time", event.target.value)} /></label></div> : null}

          {kind === "booking" ? <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Start date<input type="date" min={tomorrowDate()} className="field-control mt-2" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label><label className="text-sm font-medium">End date<input type="date" min={form.startDate || tomorrowDate()} className="field-control mt-2" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></label><label className="text-sm font-medium">Guests<input type="number" min="1" max="30" className="field-control mt-2" value={form.guests} onChange={(event) => update("guests", Number(event.target.value))} /></label></div> : null}

          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Name<input className="field-control mt-2" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></label><label className="text-sm font-medium">Phone<input className="field-control mt-2" placeholder="+263" value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} /></label></div>
          <label className="block text-sm font-medium">Notes <span className="font-normal text-[var(--text-3)]">optional</span><textarea className="field-control mt-2 min-h-24" value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder={kind === "appointment" ? "Anything the business should know before the appointment" : "Add any useful details"} /></label>

          {kind === "ticket" && total > 0 ? <div><p className="text-sm font-medium">Payment</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => update("paymentMethod", "paynow")} className={cn("rounded-[16px] border p-4 text-left", form.paymentMethod === "paynow" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface)]")}><CreditCard className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 font-semibold">Pay online</p><p className="mt-1 text-xs text-[var(--text-3)]">Continue securely with Paynow.</p></button><button type="button" onClick={() => update("paymentMethod", "pay_later")} className={cn("rounded-[16px] border p-4 text-left", form.paymentMethod === "pay_later" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface)]")}><Clock3 className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 font-semibold">Request first</p><p className="mt-1 text-xs text-[var(--text-3)]">Business confirmation before payment.</p></button></div></div> : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={submitting}>{kind === "ticket" && form.paymentMethod === "paynow" && total > 0 ? "Continue to payment" : kind === "ticket" ? "Request tickets" : kind === "appointment" ? "Request appointment" : "Request booking"}</Button></div>
      </>}
    </Modal>
  );
}

export function TransactionSummary({ order }) {
  if (!order) return null;
  const kind = order.transactionType || (order.fulfilment === "appointment" ? "appointment" : order.fulfilment === "booking" ? "booking" : order.fulfilment === "ticketing" ? "ticket" : null);
  if (!kind) return null;
  const schedule = kind === "appointment" ? `${order.appointment?.date || "Date pending"} · ${order.appointment?.time || "Time pending"}` : kind === "booking" ? `${order.booking?.startDate || "Date pending"}${order.booking?.endDate && order.booking.endDate !== order.booking.startDate ? ` → ${order.booking.endDate}` : ""}` : order.event?.startsAt ? new Date(order.event.startsAt).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" }) : `${order.event?.date || "Event date pending"} ${order.event?.time || ""}`;
  return <div className="mt-4 rounded-[16px] bg-[var(--surface-2)] p-4 text-sm"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)]">{kind === "ticket" ? <Ticket className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}</span><div><p className="font-semibold">{kind === "ticket" ? "Tickets" : kind === "appointment" ? "Appointment" : "Booking"}</p><p className="mt-0.5 text-xs text-[var(--text-3)]">{schedule}</p></div></div>{kind === "ticket" && order.ticketCode ? <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Entry code</p><p className="mt-1 font-mono text-xl font-semibold tracking-[.12em]">{order.ticketCode}</p><p className="mt-1 text-xs text-[var(--text-3)]">Show this code at check-in. Do not share it publicly.</p></div> : null}</div>;
}
