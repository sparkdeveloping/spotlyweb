"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  CreditCard,
  Heart,
  MapPin,
  Minus,
  Package,
  PackageCheck,
  Plus,
  ShoppingBasket,
  Share2,
  Ticket,
  UsersRound
} from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui";
import { useToast } from "@/components/providers";
import { authenticatedFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { track } from "@/lib/firebase-services";
import { countryDefinition, countryTimeZone } from "@/lib/country-engine";

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
  branch,
  saved = false,
  onSave
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
          {product.image ? <Image src={product.image} alt={product.name} fill  className="object-cover" sizes="(max-width: 768px) 100vw, 45vw" /> : <div className="flex h-full min-h-[240px] items-center justify-center text-[var(--text-3)]"><ShoppingBasket className="h-14 w-14" /></div>}
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="neutral">{product.category || archetype?.shortLabel || "Offering"}</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em]">{product.name}</h2>
            </div>
            <div className="flex items-center gap-2"><p className={cn("text-xl font-semibold", price === null && "text-warning")}>{price === null ? `No ${currency} price` : price === 0 ? "Free" : formatCurrency(price, currency)}</p>{onSave ? <button type="button" onClick={() => onSave(product)} className={cn("flex h-10 w-10 items-center justify-center rounded-full border transition", saved ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")} aria-label={saved ? "Remove from Saved" : "Save item"}><Heart className={cn("h-5 w-5", saved && "fill-current")} /></button> : null}</div>
          </div>

          {product.description ? <p className="mt-5 text-sm leading-7 text-[var(--text-2)]">{product.description}</p> : null}

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {event && starts ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><CalendarDays className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">EVENT</p><p className="mt-1 text-sm font-semibold">{starts.toLocaleString((countryDefinition(product.country || branch?.country)?.locale || "en").replace("_", "-"), { dateStyle: "medium", timeStyle: "short", timeZone: countryTimeZone(product.country || branch?.country) })}</p></div> : null}
            {event && product.venue ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><MapPin className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">VENUE</p><p className="mt-1 text-sm font-semibold">{product.venue}</p></div> : null}
            {appointment ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><Clock3 className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">DURATION</p><p className="mt-1 text-sm font-semibold">{Number(product.durationMinutes || 30)} minutes</p></div> : null}
            {booking && Number(product.capacity || 0) > 0 ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><UsersRound className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">CAPACITY</p><p className="mt-1 text-sm font-semibold">Up to {Number(product.capacity)} people</p></div> : null}
            {event && remaining !== null ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><Ticket className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">AVAILABILITY</p><p className="mt-1 text-sm font-semibold">{remaining > 0 ? `${remaining} remaining` : "Sold out"}</p></div> : null}
            {(product.unit || product.packSize || product.variant) ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4"><PackageCheck className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-xs font-semibold text-[var(--text-3)]">DETAILS</p><p className="mt-1 text-sm font-semibold">{[product.variant, product.packSize, product.unit].filter(Boolean).join(" · ")}</p></div> : null}
          </div>

          {pickup ? (
            <div className="mt-7 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div><p className="font-semibold">Add to basket</p><p className="mt-1 text-xs text-[var(--text-3)]">Pickup and delivery options are confirmed at checkout.</p></div>
                {quantity > 0 ? <div className="flex items-center rounded-xl border bg-[var(--surface)] p-1"><button type="button" onClick={() => onQuantityChange(product, quantity - 1)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"><Minus className="h-4 w-4" /></button><span className="w-9 text-center text-sm font-semibold">{quantity}</span><button type="button" disabled={unavailable || price === null} onClick={() => onQuantityChange(product, quantity + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-40"><Plus className="h-4 w-4" /></button></div> : <Button disabled={unavailable || price === null} onClick={() => onQuantityChange(product, 1)}><Plus className="h-4 w-4" />Add</Button>}
              </div>
            </div>
          ) : transactable ? (
            <div className="mt-7">
              <Button className="w-full" disabled={unavailable || (event && remaining === 0)} onClick={() => onBook(product)}>{event ? <Ticket className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}{cta}</Button>
              <p className="mt-3 text-center text-xs leading-5 text-[var(--text-3)]">Spotly sends the request directly to this business and keeps its status in Activity.</p>
            </div>
          ) : (
            <div className="mt-7 rounded-[16px] bg-[var(--surface-2)] p-4">
              <p className="font-semibold">Available from this business</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">This listing is informational right now. Use the business page for its published location and contact details.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function CustomerTransactionModal({ open, onClose, product, business, branches = [], selectedBranchId, currency, user, profile, archetype, onComplete }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [form, setForm] = useState({
    checkoutId: "",
    branchId: selectedBranchId || "",
    quantity: 1,
    contactName: user?.displayName || "",
    contactPhone: user?.phoneNumber || "",
    notes: "",
    date: "",
    time: "",
    startDate: "",
    endDate: "",
    guests: 1,
    paymentMethod: "pay_later",
    promoCode: ""
  });

  const kind = archetype?.id === "ticketing_events" ? "ticket" : archetype?.id === "appointments_services" ? "appointment" : "booking";
  const price = offerPrice(product, currency) ?? 0;
  const total = price * (kind === "ticket" ? Number(form.quantity || 1) : 1);
  const promotionDiscount = Math.min(total, Math.max(0, Number(promotion?.discount || 0)));
  const adjustedTotal = Math.max(0, total - promotionDiscount);
  const branch = useMemo(() => branches.find((item) => item.id === form.branchId) || branches.find((item) => item.id === selectedBranchId) || branches[0] || null, [branches, form.branchId, selectedBranchId]);
  const appointmentDays = kind === "appointment" ? (availability?.days || []) : [];
  const bookingDays = kind === "booking" ? (availability?.days || []) : [];
  const selectedAppointment = appointmentDays.find((item) => item.date === form.date) || null;
  const availableAppointmentSlots = (selectedAppointment?.slots || []).filter((slot) => slot.available);
  const ticketRemaining = availability?.ticket?.remaining ?? product?.remainingCapacity ?? product?.capacity ?? null;
  const ticketMax = Number(availability?.rules?.maxQuantity || product?.maxQuantity || 10);
  const ticketLimit = kind === "ticket" ? Math.max(0, Math.min(ticketMax, ticketRemaining == null ? ticketMax : Number(ticketRemaining))) : 1;
  const eventStartsAt = availability?.ticket?.startsAt || product?.startsAt || null;
  const eventTier = availability?.ticket?.tier || product?.ticketTier || product?.variant || product?.name || "Standard";
  const timeZone = availability?.timeZone || countryTimeZone(branch?.country || business?.country);

  useEffect(() => {
    if (!open || !product) return;
    const defaultPayment = price > 0 && product.requiresBusinessReview !== true ? "paynow" : "pay_later";
    setError("");
    setSuccess(null);
    setAvailability(null);
    setForm({
      checkoutId: checkoutId(),
      branchId: selectedBranchId || branches[0]?.id || "",
      quantity: 1,
      contactName: user?.displayName || "",
      contactPhone: user?.phoneNumber || "",
      notes: "",
      date: "",
      time: "",
      startDate: "",
      endDate: "",
      guests: 1,
      paymentMethod: defaultPayment,
      promoCode: ""
    });
    setPromotion(null);
  }, [open, product?.id, selectedBranchId, user?.displayName, user?.phoneNumber, kind, price, branches]);

  useEffect(() => {
    if (!open || !product?.id || !form.branchId) return;
    const controller = new AbortController();
    setAvailabilityLoading(true);
    setError("");
    fetch(`/api/public/transactions/availability?itemId=${encodeURIComponent(product.id)}&branchId=${encodeURIComponent(form.branchId)}&days=90`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) throw new Error(payload.error || "Availability could not be loaded.");
        return payload;
      })
      .then((payload) => {
        setAvailability(payload);
        if (payload.kind === "appointment") {
          const day = (payload.days || []).find((item) => item.slots?.some((slot) => slot.available));
          const slot = day?.slots?.find((item) => item.available);
          setForm((current) => ({ ...current, date: day?.date || "", time: slot?.time || "" }));
        } else if (payload.kind === "booking") {
          const day = (payload.days || []).find((item) => item.available);
          setForm((current) => ({ ...current, startDate: day?.date || "", endDate: day?.date || "" }));
        } else if (payload.kind === "ticket") {
          setForm((current) => ({ ...current, quantity: Math.max(1, Math.min(Number(current.quantity || 1), Math.max(1, Number(payload.rules?.maxQuantity || 10)))) }));
        }
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") {
          setAvailability(null);
          setError(reason.message || "Availability could not be loaded.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [open, product?.id, form.branchId]);

  if (!product) return null;

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  function bookingReservedDates() {
    if (!form.startDate || !form.endDate) return [];
    const start = new Date(`${form.startDate}T00:00:00Z`);
    const end = new Date(`${form.endDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const same = start.getTime() === end.getTime();
    const values = [];
    const cursor = new Date(start);
    while (cursor < end || (same && values.length === 0)) {
      values.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (values.length >= 90) break;
    }
    return values;
  }

  async function shareEvent() {
    const title = availability?.ticket?.eventName || product?.eventName || product?.name || "Spotly Live";
    const text = `${title}${eventStartsAt ? ` · ${new Date(eventStartsAt).toLocaleString()}` : ""}`;
    const url = typeof window === "undefined" ? "" : window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Event link copied.", { type: "success", title: "Ready to share" });
      }
    } catch (reason) {
      if (reason?.name !== "AbortError") toast("The event link could not be shared.", { type: "error" });
    }
  }

  async function quotePromotion() {
    if (!user || user.isAnonymous) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!form.branchId) { setError("Choose a business location first."); return; }
    setPromotionLoading(true);
    setError("");
    try {
      const result = await authenticatedFetch("/api/customer/promotions/quote", {
        method: "POST",
        body: JSON.stringify({
          businessId: business.id,
          branchId: form.branchId,
          currency,
          code: form.promoCode.trim(),
          items: [{ productId: product.id, quantity: kind === "ticket" ? Number(form.quantity || 1) : 1 }]
        })
      });
      setPromotion(result.applied ? result.promotion : null);
      if (result.applied) {
        track("promotion_applied", { service: kind, promotion_id: result.promotion?.id || "", discount: Number(result.promotion?.discount || 0), currency });
        toast(`${result.promotion?.label || "Offer"} applied.`, { type: "success", title: "Promotion applied" });
      } else setError("No automatic promotion applies to this request.");
    } catch (reason) {
      setPromotion(null);
      setError(reason.message || "That promotion could not be applied.");
    } finally {
      setPromotionLoading(false);
    }
  }

  function validate() {
    if (!form.branchId) return "Choose a business location.";
    if (availabilityLoading) return "Spotly is still checking live availability.";
    if (!availability) return "Live availability is not available yet. Refresh and try again.";
    if (form.contactName.trim().length < 2) return "Add the customer name.";
    if (form.contactPhone.trim().length < 7) return "Add a phone number the business can use.";
    if (kind === "ticket") {
      if (availability?.rules?.salesOpen === false) return "Ticket sales are not currently open for this event.";
      if (ticketLimit < 1) return "This event is sold out.";
      if (Number(form.quantity || 1) > ticketLimit) return `Choose up to ${ticketLimit} ticket${ticketLimit === 1 ? "" : "s"}.`;
    }
    if (kind === "appointment") {
      if (!form.date || !form.time) return "Choose an available appointment date and time.";
      const slot = appointmentDays.find((day) => day.date === form.date)?.slots?.find((item) => item.time === form.time);
      if (!slot?.available) return "That appointment slot is no longer available.";
    }
    if (kind === "booking") {
      if (!form.startDate || !form.endDate) return "Choose booking dates.";
      const selected = bookingReservedDates();
      if (!selected.length) return "Choose a valid booking date range.";
      const rows = new Map(bookingDays.map((day) => [day.date, day]));
      const guests = Math.max(1, Number(form.guests || 1));
      const capacityMode = availability?.rules?.capacityMode || "booking";
      const unavailable = selected.some((date) => {
        const row = rows.get(date);
        if (!row?.available) return true;
        return capacityMode === "guests" && row.remaining != null && Number(row.remaining) < guests;
      });
      if (unavailable) return "One or more selected dates no longer have enough capacity.";
    }
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
        paymentMethod: adjustedTotal > 0 ? form.paymentMethod : "pay_later",
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        notes: form.notes.trim(),
        promoCode: form.promoCode.trim(),
        ...(kind === "appointment" ? { appointment: { date: form.date, time: form.time } } : {}),
        ...(kind === "booking" ? { booking: { startDate: form.startDate, endDate: form.endDate || form.startDate, guests: Number(form.guests || 1) } } : {})
      };
      const result = await authenticatedFetch("/api/customer/transactions/create", { method: "POST", body: JSON.stringify(payload) });
      track("transaction_created", { service: kind, currency, payment_method: payload.paymentMethod, amount: Number(result.total || adjustedTotal || 0), discount: Number(result.discount || 0) });
      if (result.paymentRequired && payload.paymentMethod === "paynow") {
        const payment = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: result.orderId, channel: "web" }) });
        onComplete?.(result);
        if (payment.redirectUrl) {
          window.location.assign(payment.redirectUrl);
          return;
        }
      }
      setSuccess(result);
      onComplete?.(result);
      const message = kind === "ticket" ? (result.status === "issued" ? "Your tickets are ready." : "Ticket checkout created.") : kind === "appointment" ? (result.status === "confirmed" ? "Appointment confirmed." : "Appointment request sent.") : (result.status === "confirmed" ? "Booking confirmed." : "Booking request sent.");
      toast(message, { type: "success", title: "Added to Activity" });
    } catch (reason) {
      setError(reason.message || "The request could not be created. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = kind === "ticket" ? "Get tickets" : kind === "appointment" ? "Choose an appointment" : "Choose your dates";
  const description = availabilityLoading ? "Checking live availability…" : kind === "ticket" ? "Choose a ticket tier and quantity." : `Availability shown in ${timeZone || "the location's timezone"}.`;
  const availableBookingDays = bookingDays.filter((item) => item.available);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="lg">
      {success ? <div className="p-6 sm:p-8"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><Check className="h-8 w-8" /></div><div className="mx-auto mt-5 max-w-lg text-center"><h3 className="text-2xl font-semibold tracking-[-.035em]">It’s in Activity</h3><p className="mt-3 text-sm leading-7 text-[var(--text-2)]">Reference <strong>{success.number}</strong>. {success.status === "issued" ? "Your digital tickets are ready now." : success.status === "confirmed" ? "Your reservation is confirmed." : success.paymentRequired ? "Complete payment to finish this reservation." : "The business can now review your request."}</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={onClose}>Done</Button><Button variant="outline" onClick={() => window.location.assign(`/?view=activity&order=${encodeURIComponent(success.orderId)}`)}>Open Activity</Button>{kind === "ticket" ? <Button variant="outline" onClick={shareEvent}><Share2 className="h-4 w-4" />Share event</Button> : null}</div></div></div> : <>
        <div className="space-y-5 p-5 sm:p-6">
          {error ? <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{error}</div> : null}

          <div className="flex gap-4 rounded-[16px] bg-[var(--surface-2)] p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] bg-[var(--surface)]">{product.image ? <Image src={product.image} alt="" fill className="object-cover" sizes="64px" /> : <div className="flex h-full items-center justify-center"><Ticket className="h-6 w-6 text-[var(--text-3)]" /></div>}</div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{availability?.ticket?.eventName || product.name}</p><p className="mt-1 text-xs text-[var(--text-3)]">{business?.name}{branch ? ` · ${branch.branchName || branch.name}` : ""}{kind === "ticket" ? ` · ${eventTier}` : ""}</p><p className="mt-2 text-sm font-semibold">{price === 0 ? "Free" : promotionDiscount > 0 ? <><span className="text-[var(--success)]">{formatCurrency(adjustedTotal, currency)}</span><span className="ml-2 text-xs font-normal text-[var(--text-3)] line-through">{formatCurrency(total, currency)}</span></> : formatCurrency(total, currency)}</p></div>
            {kind === "ticket" ? <button type="button" onClick={shareEvent} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]" aria-label="Share event"><Share2 className="h-4 w-4" /></button> : null}
          </div>

          {kind === "ticket" && eventStartsAt ? <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[16px] border border-[var(--border-subtle)] p-4"><CalendarDays className="h-5 w-5 text-[var(--accent)]" /><p className="mt-2 text-xs font-semibold text-[var(--text-3)]">EVENT</p><p className="mt-1 text-sm font-semibold">{new Date(eventStartsAt).toLocaleString((countryDefinition(availability?.country || branch?.country || business?.country)?.locale || "en").replace("_", "-"), { dateStyle: "medium", timeStyle: "short", timeZone })}</p></div><div className="rounded-[16px] border border-[var(--border-subtle)] p-4"><Ticket className="h-5 w-5 text-[var(--accent)]" /><p className="mt-2 text-xs font-semibold text-[var(--text-3)]">TIER</p><p className="mt-1 text-sm font-semibold">{eventTier}{ticketRemaining != null ? ` · ${Math.max(0, Number(ticketRemaining))} left` : ""}</p></div></div> : null}

          {branches.length > 1 ? <div><p className="text-sm font-medium">Location</p><div className="mt-2 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">{branches.map((item) => { const active = form.branchId === item.id; return <button key={item.id} type="button" onClick={() => update("branchId", item.id)} className="flex w-full items-center gap-3 py-3.5 text-left"><span className={cn("flex h-9 w-9 items-center justify-center rounded-[10px]", active ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--surface-2)] text-[var(--text-2)]")}><MapPin className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.branchName || item.name}</span><span className="mt-0.5 block text-xs text-[var(--text-3)]">{item.city || "City not selected"}</span></span>{active ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}</button>; })}</div></div> : null}

          {availabilityLoading ? <div className="rounded-[16px] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-2)]">Checking current capacity and published availability…</div> : null}

          {kind === "ticket" ? <div><p className="text-sm font-medium">Tickets · {eventTier}</p><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => update("quantity", Math.max(1, Number(form.quantity) - 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border"><Minus className="h-4 w-4" /></button><span className="w-10 text-center text-lg font-semibold">{form.quantity}</span><button type="button" disabled={ticketLimit < 1 || Number(form.quantity) >= ticketLimit || availability?.rules?.salesOpen === false} onClick={() => update("quantity", Math.min(ticketLimit, Number(form.quantity) + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button></div>{availability?.rules?.salesOpen === false ? <p className="mt-2 text-xs text-[var(--danger)]">Ticket sales are closed.</p> : null}</div> : null}

          {kind === "appointment" ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Available date<select className="field-control mt-2" value={form.date} onChange={(event) => { const date = event.target.value; const day = appointmentDays.find((item) => item.date === date); const slot = day?.slots?.find((item) => item.available); setForm((current) => ({ ...current, date, time: slot?.time || "" })); }}><option value="">Choose a date</option>{appointmentDays.filter((day) => day.slots?.some((slot) => slot.available)).map((day) => <option key={day.date} value={day.date}>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</option>)}</select></label><label className="text-sm font-medium">Available time<select className="field-control mt-2" value={form.time} onChange={(event) => update("time", event.target.value)} disabled={!form.date}><option value="">Choose a time</option>{availableAppointmentSlots.map((slot) => <option key={slot.time} value={slot.time}>{slot.time}{slot.remaining != null ? ` · ${slot.remaining} left` : ""}</option>)}</select></label><p className="sm:col-span-2 text-xs text-[var(--text-3)]">Times are shown in {timeZone}. Spotly checks capacity again when you confirm.</p></div> : null}

          {kind === "booking" ? <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Start date<select className="field-control mt-2" value={form.startDate} onChange={(event) => { const startDate = event.target.value; setForm((current) => ({ ...current, startDate, endDate: current.endDate && current.endDate >= startDate ? current.endDate : startDate })); }}><option value="">Choose</option>{availableBookingDays.map((day) => <option key={day.date} value={day.date}>{day.date}{day.remaining != null ? ` · ${day.remaining} left` : ""}</option>)}</select></label><label className="text-sm font-medium">End / checkout<select className="field-control mt-2" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} disabled={!form.startDate}><option value="">Choose</option>{bookingDays.filter((day) => day.date >= form.startDate).map((day) => <option key={day.date} value={day.date} disabled={!day.available}>{day.date}{!day.available ? " · unavailable" : ""}</option>)}</select></label><label className="text-sm font-medium">Guests<input type="number" min="1" max="30" className="field-control mt-2" value={form.guests} onChange={(event) => update("guests", Number(event.target.value))} /></label><p className="sm:col-span-3 text-xs text-[var(--text-3)]">Spotly validates every reserved day and capacity again at checkout.</p></div> : null}

          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Name<input className="field-control mt-2" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} /></label><label className="text-sm font-medium">Phone<input className="field-control mt-2" placeholder="Phone number" value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} /></label></div>
          <label className="block text-sm font-medium">Notes <span className="font-normal text-[var(--text-3)]">optional</span><textarea className="field-control mt-2 min-h-24" value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder={kind === "appointment" ? "Anything the business should know before the appointment" : "Add any useful details"} /></label>

          {total > 0 ? <div className="rounded-[16px] border border-[var(--border-subtle)] p-4"><div className="flex items-center gap-2"><BadgePercent className="h-5 w-5 text-[var(--accent)]" /><p className="text-sm font-semibold">Promotion</p></div><div className="mt-3 flex gap-2"><input className="field-control min-w-0 flex-1 uppercase" value={form.promoCode} onChange={(event) => { update("promoCode", event.target.value.toUpperCase()); setPromotion(null); }} placeholder="Code, if you have one" /><Button type="button" variant="outline" loading={promotionLoading} onClick={quotePromotion}>Apply</Button></div>{promotionDiscount > 0 ? <div className="mt-3 flex items-center justify-between rounded-[12px] bg-[var(--success-soft)] px-3 py-2 text-sm"><span className="font-medium">{promotion?.label || "Promotion applied"}</span><span className="font-semibold">−{formatCurrency(promotionDiscount, currency)}</span></div> : null}</div> : null}

          {adjustedTotal > 0 ? <div><p className="text-sm font-medium">Payment</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => update("paymentMethod", "paynow")} className={cn("rounded-[16px] border p-4 text-left", form.paymentMethod === "paynow" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface)]")}><CreditCard className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 font-semibold">Pay online</p><p className="mt-1 text-xs text-[var(--text-3)]">Secure payment through Spotly&apos;s configured payment flow.</p></button><button type="button" onClick={() => update("paymentMethod", "pay_later")} className={cn("rounded-[16px] border p-4 text-left", form.paymentMethod === "pay_later" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "bg-[var(--surface)]")}><Clock3 className="h-5 w-5 text-[var(--accent)]" /><p className="mt-3 font-semibold">Pay later</p><p className="mt-1 text-xs text-[var(--text-3)]">{product.requiresBusinessReview ? "Request confirmation before payment." : "Reserve now where this business allows later payment."}</p></button></div></div> : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={submitting} disabled={availabilityLoading || !availability}>{form.paymentMethod === "paynow" && adjustedTotal > 0 ? "Continue to payment" : kind === "ticket" ? "Get tickets" : kind === "appointment" ? "Confirm appointment" : "Confirm booking"}</Button></div>
      </>}
    </Modal>
  );
}

export function TransactionSummary({ order }) {
  if (!order) return null;
  const kind = order.transactionType || (order.fulfilment === "appointment" ? "appointment" : order.fulfilment === "booking" ? "booking" : order.fulfilment === "ticketing" ? "ticket" : null);
  if (!["ride", "send", "appointment", "booking", "ticket"].includes(kind)) return null;
  const route = `${order.pickup?.area || order.pickup?.label || "Pickup"} → ${order.dropoff?.area || order.dropoff?.label || (kind === "send" ? "Drop-off" : "Destination")}`;
  const schedule = ["ride", "send"].includes(kind) ? route : kind === "appointment" ? `${order.appointment?.date || "Date pending"} · ${order.appointment?.time || "Time pending"}` : kind === "booking" ? `${order.booking?.startDate || "Date pending"}${order.booking?.endDate && order.booking.endDate !== order.booking.startDate ? ` → ${order.booking.endDate}` : ""}` : order.event?.startsAt ? new Date(order.event.startsAt).toLocaleString((countryDefinition(order.country)?.locale || "en").replace("_", "-"), { dateStyle: "medium", timeStyle: "short", timeZone: order.timeZone || countryTimeZone(order.country) }) : `${order.event?.date || "Event date pending"} ${order.event?.time || ""}`;
  const label = kind === "ride" ? "Ride" : kind === "send" ? "Send" : kind === "ticket" ? "Tickets" : kind === "appointment" ? "Appointment" : "Booking";
  return <div className="mt-4 rounded-[16px] bg-[var(--surface-2)] p-4 text-sm"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)]">{kind === "ride" ? <CarFront className="h-4 w-4" /> : kind === "send" ? <Package className="h-4 w-4" /> : kind === "ticket" ? <Ticket className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}</span><div><p className="font-semibold">{label}</p><p className="mt-0.5 text-xs text-[var(--text-3)]">{schedule}</p>{["ride", "send"].includes(kind) ? <p className="mt-1 text-xs capitalize text-[var(--text-3)]">{String(order.rideStatus || order.deliveryStatus || order.status || "requested").replaceAll("_", " ")}</p> : null}</div></div>{kind === "ticket" && order.ticketCode ? <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--text-3)]">Entry code</p><p className="mt-1 font-mono text-xl font-semibold tracking-[.12em]">{order.ticketCode}</p><p className="mt-1 text-xs text-[var(--text-3)]">Show this code at check-in. Do not share it publicly.</p></div> : null}</div>;
}
