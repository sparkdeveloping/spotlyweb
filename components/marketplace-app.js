"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronRight, CreditCard, Heart, LoaderCircle, LocateFixed, MapPin, Minus, PackageCheck, Plus, Search, ShieldCheck, ShoppingBasket, Store, X } from "lucide-react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, Overlay, SearchField, StatusBadge, TabPanel, Tabs } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { saveFavorite, searchLiveBusinesses, subscribePublicBranches, subscribePublicBusinessCatalog, subscribeCustomerOrders, subscribeFavorites } from "@/lib/firebase-services";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { businessArchetype } from "@/data/business-archetypes";
import { migrateLegacyState, readState, removeState, writeState } from "@/lib/browser-state";
import { branchAcceptedCurrencies, branchPaymentMethods, pickupAvailability } from "@/lib/pickup-availability";
import { resolveProductForBranch } from "@/lib/product-offers";

const VIEW_VALUES = new Set(["discover", "search", "orders", "saved"]);
const CART_KEY = "spotly-marketplace-cart";
const CHECKOUT_KEY = "spotly-checkout-draft";
const LOCATION_KEY = "spotly-marketplace-location";
const MARKETPLACE_TABS_ID = "marketplace-sections";

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function priceFor(product, currency) {
  const value = product?.prices?.[currency] ?? (product?.currency === currency || !product?.currency ? product?.price : undefined);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function distanceKm(from, to) {
  if (![from?.lat, from?.lng, to?.lat, to?.lng].every(Number.isFinite)) return null;
  const radius = 6371;
  const radians = (value) => value * Math.PI / 180;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MarketplaceGate({ privateBeta }) {
  return <main className="min-h-screen bg-[var(--background)] px-4 py-16 text-[var(--text)] sm:px-6"><div className="mx-auto max-w-3xl rounded-[20px] border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--surface)] p-7 text-center sm:p-12"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--on-accent-soft)]"><ShoppingBasket className="h-8 w-8" /></div><Badge tone="purple" className="mt-6">Pickup pilot</Badge><h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Customer ordering is opening by invitation.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-2)]">Businesses and pickup operations are being prepared before ordering opens more widely. {privateBeta ? "This account does not currently have preview access." : "The pilot is currently paused."}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/">Join the launch list</Link></Button><Button asChild variant="outline"><Link href="/claim">Find or add a business</Link></Button><Button asChild variant="ghost"><Link href="/support">Get help</Link></Button></div></div></main>;
}

function LocationControl({ value, cities, supportedAreas, onChange, onLocate, locating }) {
  const areas = supportedAreas?.[value.city] || [];
  return <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><label><span className="sr-only">City</span><select className="field-control h-12 w-full" value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value, area: "", coordinates: null })}>{cities.map((city) => <option key={city}>{city}</option>)}</select></label><label><span className="sr-only">Area or suburb</span>{areas.length ? <select className="field-control h-12 w-full" value={value.area} onChange={(event) => onChange({ ...value, area: event.target.value })}><option value="">All areas in {value.city}</option>{areas.map((area) => <option key={area}>{area}</option>)}</select> : <input className="field-control h-12 w-full" value={value.area} onChange={(event) => onChange({ ...value, area: event.target.value })} placeholder={`Area or suburb in ${value.city}`} />}</label><Button variant="outline" onClick={onLocate} loading={locating}><LocateFixed className="h-4 w-4" />Use my location</Button></div>;
}

function BusinessVisual({ business }) {
  const image = business.coverImage || business.image || business.logoUrl;
  if (image) return <Image src={image} alt="" fill unoptimized className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />;
  return <div className="flex h-full items-center justify-center bg-[var(--surface-2)]"><span className="flex h-16 w-16 items-center justify-center rounded-xl border bg-[var(--surface)] text-2xl font-semibold text-violet">{(business.name || "B").slice(0, 1).toUpperCase()}</span></div>;
}

function BusinessCard({ business, favorite, onFavorite, onOpen, distance }) {
  const archetype = businessArchetype(business);
  const locationCount = Number(business.branchCount || business.locationCount || 0);
  const verified = ["approved", "verified"].includes(business.verificationStatus);
  return <article className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition hover:border-violet/30"><button onClick={() => onOpen(business)} className="block w-full text-left"><div className="relative aspect-[16/9] overflow-hidden bg-[var(--surface-2)]"><BusinessVisual business={business} /><div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" /><div className="absolute bottom-3 left-3 flex flex-wrap gap-2"><Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">{business.category || "Business"}</Badge>{verified && <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge>}</div></div><div className="p-5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{business.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-[var(--text-3)]"><MapPin className="h-4 w-4" />{distance !== null ? `${distance.toFixed(1)} km away` : locationCount ? `${locationCount} ${archetype.nouns.branch}${locationCount === 1 ? "" : "s"}` : business.city || "Location not provided"}</p></div><ChevronRight className="mt-1 h-5 w-5 text-[var(--text-3)]" /></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-2)]">{business.description || "View locations and currently published offerings."}</p></div></button><div className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3"><Button onClick={() => onOpen(business)} className="flex-1" size="sm">View locations</Button><Button onClick={() => onFavorite(business.id)} size="icon" variant="outline" aria-label={favorite ? "Remove from saved" : "Save business"}><Heart className={cn("h-5 w-5", favorite && "fill-[var(--danger)] text-[var(--danger)]")} /></Button></div></article>;
}

function ProductCard({ product, quantity, onChange, currency, archetype }) {
  const price = priceFor(product, currency);
  const unavailable = product.available === false || product.active === false || product.stockStatus === "out_of_stock";
  return <Card className="flex gap-4 p-4" variant="bordered"><div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">{product.image ? <Image src={product.image} alt="" fill unoptimized className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-[var(--text-3)]"><ShoppingBasket className="h-8 w-8" /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-secondary">{[product.unit, product.packSize, product.description || product.category || `Available ${archetype.capabilities.includes("pickup_orders") ? "for pickup" : "from this business"}`].filter(Boolean).join(" · ")}</p></div><p className={cn("shrink-0 font-semibold", !price && "text-warning")}>{price ? formatCurrency(price, currency) : `Not available in ${currency}`}</p></div><div className="mt-4 flex items-center justify-between gap-3">{unavailable ? <Badge tone="neutral">Unavailable</Badge> : product.stockQuantity > 0 ? <span className="text-xs text-secondary">{product.stockQuantity} available</span> : <span />}{quantity ? <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"><button onClick={() => onChange(product, quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--surface-hover)]" aria-label={`Decrease ${product.name}`}><Minus className="h-4 w-4" /></button><span className="w-9 text-center text-sm font-semibold">{quantity}</span><button disabled={!price || unavailable || (product.maxQuantity && quantity >= product.maxQuantity)} onClick={() => onChange(product, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-md bg-violet text-[var(--on-accent)] disabled:opacity-40" aria-label={`Increase ${product.name}`}><Plus className="h-4 w-4" /></button></div> : <Button size="sm" disabled={!price || unavailable} onClick={() => onChange(product, 1)}><Plus className="h-4 w-4" />{price ? "Add" : "Price unavailable"}</Button>}</div></div></Card>;
}

function OrderCard({ order, onPay, highlighted = false, innerRef }) {
  const created = timestamp(order.createdAt);
  const paymentNeeded = ["unpaid", "pending"].includes(order.paymentStatus);
  return <div ref={innerRef}><Card className={cn("p-5 transition", highlighted && "border-violet ring-4 ring-violet/10")}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.08em] text-[var(--text-3)]">{order.number || order.id}</p><h3 className="mt-2 text-lg font-semibold">{order.businessName || "Spotly order"}</h3><p className="mt-1 text-sm text-secondary">{created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Just now"}</p></div><div className="text-right"><StatusBadge status={order.status || "submitted"} /><p className="mt-3 font-semibold">{formatCurrency(order.totals?.total || 0, order.currency)}</p></div></div><div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4 text-sm"><p className="font-semibold">Pickup: {order.pickup?.date || "To be confirmed"} · {order.pickup?.slot || "Time pending"}</p><p className="mt-1 text-[var(--text-2)]">{order.branchName || "Pickup location"}</p></div>{paymentNeeded && <Button className="mt-4 w-full" onClick={() => onPay(order)}><CreditCard className="h-4 w-4" />Continue payment</Button>}</Card></div>;
}

function BasketContents({ cartItems, cartTotal, currency, onCheckout, onClose }) {
  return <div className="p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your basket</h2>{onClose && <button onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" aria-label="Close basket"><X className="h-5 w-5" /></button>}</div>{cartItems.length ? <><div className="mt-5 space-y-3">{cartItems.map((item) => <div key={item.id} className="flex items-center gap-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-semibold text-[var(--on-accent-soft)]">{item.quantity}</span><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="font-semibold">{formatCurrency(priceFor(item, currency) * item.quantity, currency)}</span></div>)}</div><div className="my-5 border-t" /><div className="flex items-center justify-between text-lg font-semibold"><span>Subtotal</span><span>{formatCurrency(cartTotal, currency)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--text-3)]">Pickup availability is checked from this location’s configured hours and capacity.</p><Button className="mt-5 w-full" onClick={onCheckout}>Choose pickup details</Button></> : <div className="py-10 text-center"><ShoppingBasket className="mx-auto h-8 w-8 text-[var(--text-3)]" /><p className="mt-3 text-sm font-semibold">Your basket is empty</p></div>}</div>;
}

function CheckoutModal({ open, onClose, business, branches, selectedBranchId, cartItems, currency, user, onComplete }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ checkoutId: "", branchId: "", date: "", slot: "", slotId: "", paymentMethod: "", contactName: user?.displayName || "", contactPhone: user?.phoneNumber || "", alternativePhone: "", notes: "", substitutionPreference: "contact_me" });
  const steps = ["Basket", "Pickup", "Contact", "Payment", "Review"];
  const selectedBranch = branches.find((branch) => branch.id === form.branchId);
  const availability = useMemo(() => pickupAvailability(selectedBranch), [selectedBranch]);
  const methods = useMemo(() => branchPaymentMethods(selectedBranch), [selectedBranch]);
  const total = cartItems.reduce((sum, item) => sum + (priceFor(item, currency) || 0) * item.quantity, 0);
  const unresolvedPrice = cartItems.some((item) => !priceFor(item, currency));

  useEffect(() => {
    if (!open) return;
    const saved = migrateLegacyState(CHECKOUT_KEY, user) || readState(CHECKOUT_KEY, user, null);
    const preferred = branches.some((branch) => branch.id === selectedBranchId) ? selectedBranchId : branches[0]?.id || "";
    const checkoutId = saved?.checkoutId || globalThis.crypto?.randomUUID?.() || `checkout-${new Date().getTime().toString(36)}`;
    setForm((current) => ({ ...current, ...(saved || {}), checkoutId: saved?.checkoutId || current.checkoutId || checkoutId, branchId: saved?.branchId && branches.some((branch) => branch.id === saved.branchId) ? saved.branchId : preferred, contactName: saved?.contactName || current.contactName || user?.displayName || "", contactPhone: saved?.contactPhone || current.contactPhone || user?.phoneNumber || "" }));
  }, [open, branches, selectedBranchId, user]);

  useEffect(() => { if (open) writeState(CHECKOUT_KEY, user, form); }, [form, open, user]);
  useEffect(() => {
    if (!selectedBranch) return;
    const next = pickupAvailability(selectedBranch);
    setForm((current) => {
      const validDay = next.days.find((day) => day.date === current.date);
      const validSlot = validDay?.slots.find((slot) => slot.label === current.slot);
      const method = methods.includes(current.paymentMethod) ? current.paymentMethod : methods[0] || "";
      const chosenSlot = validSlot || next.earliest?.slot || null;
      return { ...current, date: validDay ? current.date : next.earliest?.date || "", slot: chosenSlot?.label || "", slotId: chosenSlot?.id || "", paymentMethod: method };
    });
  }, [selectedBranch, methods]);

  const day = availability.days.find((item) => item.date === form.date);
  function validationFor(currentStep) {
    if (unresolvedPrice) return "One or more items do not have a valid price in the selected currency.";
    if (currentStep === 1 && !availability.available) return availability.reason;
    if (currentStep === 1 && (!form.branchId || !form.date || !form.slot)) return "Choose an available pickup date and time.";
    if (currentStep === 2 && !form.contactName.trim()) return "Enter the pickup contact name.";
    if (currentStep === 2 && !/^\+?[0-9\s-]{7,18}$/.test(form.contactPhone.trim())) return "Enter a valid pickup phone number.";
    if (currentStep === 3 && !form.paymentMethod) return "This location has not configured a payment method for checkout.";
    return "";
  }
  function next() { const message = validationFor(step); if (message) { setError(message); return; } setError(""); setStep((value) => Math.min(4, value + 1)); }
  async function submit() {
    const message = validationFor(4); if (message) { setError(message); return; }
    if (!user || user.isAnonymous) { window.location.assign(`/login?next=${encodeURIComponent("/marketplace")}`); return; }
    setSubmitting(true); setError("");
    try {
      const order = await authenticatedFetch("/api/orders/create", { method: "POST", body: JSON.stringify({ checkoutId: form.checkoutId, businessId: business.id, branchId: form.branchId, items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })), currency, paymentMethod: form.paymentMethod, pickup: { date: form.date, slot: form.slot, slotId: form.slotId, contactName: form.contactName, contactPhone: form.contactPhone, alternativePhone: form.alternativePhone, notes: form.notes, substitutionPreference: form.substitutionPreference } }) });
      if (order.paymentRequired) {
        const channel = ["ecocash", "onemoney"].includes(form.paymentMethod) ? form.paymentMethod : "web";
        const payment = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.orderId, channel, phone: form.contactPhone }) });
        if (payment.redirectUrl) window.location.assign(payment.redirectUrl); else toast(payment.instructions || "Payment request sent.", { type: "success" });
      } else toast("Order placed. The business will confirm your pickup.", { type: "success" });
      removeState(CHECKOUT_KEY, user); setStep(0); onComplete(order); onClose();
    } catch (submissionError) { setError(submissionError.message || "The order could not be placed. Try again."); }
    finally { setSubmitting(false); }
  }
  const field = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  return <Modal open={open} onClose={onClose} title="Complete your pickup order" description={`Step ${step + 1} of ${steps.length}: ${steps[step]}`} size="lg"><div className="border-b px-5 py-4"><div className="flex gap-2">{steps.map((label, index) => <div key={label} className="min-w-0 flex-1"><div className={cn("h-1.5 rounded-full", index <= step ? "bg-violet" : "bg-[var(--border)]")} /><p className={cn("mt-2 hidden text-xs sm:block", index === step ? "font-semibold text-violet" : "text-[var(--text-3)]")}>{label}</p></div>)}</div></div><div className="min-h-[360px] p-5 sm:p-6">{error && <div role="alert" className="mb-5 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-3 text-sm text-[var(--on-danger-soft)]">{error}</div>}{step === 0 && <div><div className="rounded-lg bg-[var(--accent-soft)] p-4"><p className="font-semibold">{business?.name}</p><p className="mt-1 text-sm text-[var(--on-accent-soft)]">{cartItems.reduce((sum,item) => sum + item.quantity,0)} items · {formatCurrency(total,currency)}</p></div><div className="mt-5 divide-y">{cartItems.map((item) => <div key={item.id} className="flex gap-3 py-3 text-sm"><span className="font-semibold">{item.quantity}×</span><span className="flex-1">{item.name}</span><span className="font-semibold">{priceFor(item,currency) ? formatCurrency(priceFor(item,currency)*item.quantity,currency) : "Price unavailable"}</span></div>)}</div></div>}{step === 1 && <div className="space-y-5"><label className="text-sm font-medium">Pickup location<select {...field("branchId")} className="field-control mt-2 w-full">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName || branch.name || "Main location"} · {branch.city || "Zimbabwe"}</option>)}</select></label>{availability.available ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Pickup day<select value={form.date} onChange={(event) => { const nextDay = availability.days.find((item) => item.date === event.target.value); const nextSlot = nextDay?.slots?.[0] || null; setForm({ ...form, date: event.target.value, slotId: nextSlot?.id || "", slot: nextSlot?.label || "" }); }} className="field-control mt-2 w-full">{availability.days.map((item) => <option key={item.date} value={item.date}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Pickup time<select value={form.slotId} onChange={(event) => { const selected = day?.slots.find((slot) => slot.id === event.target.value); setForm({ ...form, slotId: selected?.id || "", slot: selected?.label || "" }); }} className="field-control mt-2 w-full">{(day?.slots || []).map((slot) => <option key={slot.id} value={slot.id}>{slot.label}{slot.remaining <= 3 ? ` · ${slot.remaining} left` : ""}</option>)}</select></label></div> : <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><p className="font-semibold">Pickup is not available for online checkout.</p><p className="mt-1">{availability.reason}</p></div>}<div className="rounded-lg bg-[var(--surface-2)] p-4 text-sm"><p className="font-semibold">{selectedBranch?.branchName || selectedBranch?.name || "Selected location"}</p><p className="mt-1 text-secondary">{[selectedBranch?.address,selectedBranch?.city].filter(Boolean).join(" · ") || "Address not provided"}</p></div></div>}{step === 2 && <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Pickup contact name<input {...field("contactName")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Phone<input {...field("contactPhone")} className="field-control mt-2 w-full" placeholder="+263" /></label><label className="text-sm font-medium sm:col-span-2">Alternative phone <span className="font-normal text-tertiary">optional</span><input {...field("alternativePhone")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium sm:col-span-2">Substitutions<select {...field("substitutionPreference")} className="field-control mt-2 w-full"><option value="contact_me">Contact me before substituting</option><option value="best_match">Use the closest equivalent</option><option value="remove_item">Remove unavailable items</option></select></label><label className="text-sm font-medium sm:col-span-2">Pickup notes<textarea {...field("notes")} className="field-control mt-2 min-h-24 w-full py-3" /></label></div>}{step === 3 && <div>{methods.length ? <div className="grid gap-3 sm:grid-cols-2">{methods.map((method) => <button key={method} type="button" onClick={() => setForm({ ...form, paymentMethod: method })} className={cn("rounded-xl border p-4 text-left", form.paymentMethod === method && "border-violet bg-[var(--accent-soft)] ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]")}><CreditCard className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold capitalize">{method.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-secondary">{method === "cash" ? "Pay at pickup only if this location confirms the order." : "Continue through the configured payment provider."}</p></button>)}</div> : <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]">This location has not configured a payment method for online checkout.</div>}</div>}{step === 4 && <div className="space-y-4"><div className="rounded-xl border p-4"><p className="text-xs font-semibold text-tertiary">PICKUP</p><p className="mt-2 font-semibold">{selectedBranch?.branchName || selectedBranch?.name} · {form.date} · {form.slot}</p><p className="mt-1 text-sm text-secondary">{[selectedBranch?.address,selectedBranch?.city].filter(Boolean).join(" · ")}</p></div><div className="rounded-xl border p-4"><p className="text-xs font-semibold text-tertiary">CONTACT AND SUBSTITUTIONS</p><p className="mt-2 font-semibold">{form.contactName} · {form.contactPhone}</p><p className="mt-1 text-sm text-secondary">{form.substitutionPreference.replaceAll("_"," ")}</p></div><div className="rounded-xl border p-4"><p className="text-xs font-semibold text-tertiary">PAYMENT</p><p className="mt-2 font-semibold capitalize">{form.paymentMethod.replaceAll("_"," ")} · {formatCurrency(total,currency)}</p></div></div>}</div><div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-[var(--surface)] p-5"><Button variant="ghost" disabled={step === 0 || submitting} onClick={() => { setError(""); setStep((value) => Math.max(0,value-1)); }}>Back</Button>{step < 4 ? <Button onClick={next}>Continue</Button> : <Button loading={submitting} onClick={submit}>Place order</Button>}</div></Modal>;
}

export function MarketplaceApp() {
  const { user, profile, authReady } = useAuth();
  const { settings, settingsReady } = usePlatform();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderRefs = useRef({});
  const requestedView = searchParams.get("view");
  const requestedOrder = searchParams.get("order");
  const requestedBusiness = searchParams.get("business");
  const launchCities = settings.launch?.launchCities?.length ? settings.launch.launchCities : ["Harare"];
  const defaultLocation = { city: settings.launch?.primaryCity || launchCities[0], area: "", radiusKm: 20, coordinates: null };
  const [location, setLocation] = useState(defaultLocation);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pendingBranchId, setPendingBranchId] = useState("");
  const [cart, setCart] = useState({});
  const [basketOpen, setBasketOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState(VIEW_VALUES.has(requestedView) ? requestedView : requestedOrder ? "orders" : "discover");
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [branchError, setBranchError] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reloadKey, setReloadKey] = useState(0);
  const allowed = settings.launch?.marketplaceEnabled || (settings.launch?.privateBetaEnabled && (profile?.privateBeta || profile?.roles?.some((role) => ["super_admin","admin"].includes(role))));

  function updateUrl(nextView, extras = {}) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    if (extras.order === null) params.delete("order"); else if (extras.order) params.set("order", extras.order);
    if (extras.business === null) params.delete("business"); else if (extras.business) params.set("business", extras.business);
    router.push(`/marketplace?${params.toString()}`, { scroll: false }); setView(nextView);
  }
  useEffect(() => { setView(requestedOrder ? "orders" : VIEW_VALUES.has(requestedView) ? requestedView : "discover"); }, [requestedView, requestedOrder]);
  useEffect(() => {
    const migratedCart = migrateLegacyState(CART_KEY,user);
    setCart(migratedCart || readState(CART_KEY,user,{}));
    setLocation(migrateLegacyState(LOCATION_KEY,user) || readState(LOCATION_KEY,user,defaultLocation));
  }, [user, defaultLocation]);
  useEffect(() => { writeState(CART_KEY,user,cart); }, [cart,user]);
  useEffect(() => { writeState(LOCATION_KEY,user,location); }, [location,user]);
  useEffect(() => {
    let active = true; setLoading(true); setLoadError("");
    const timer = window.setTimeout(async () => { try { const result = await searchLiveBusinesses(query,100); if (active) setBusinesses(result); } catch { if (active) { setBusinesses([]); setLoadError("Business discovery is temporarily unavailable. Check your connection and try again."); } } finally { if (active) setLoading(false); } }, query ? 250 : 0);
    return () => { active=false; clearTimeout(timer); };
  }, [query,reloadKey]);
  useEffect(() => { if (!requestedBusiness || selected || !businesses.length) return; const found=businesses.find((business)=>business.id===requestedBusiness); if(found)setSelected(found); }, [requestedBusiness,businesses,selected]);
  useEffect(() => {
    if(!selected?.id){setProducts([]);setBranches([]);setSelectedBranchId("");return undefined;}
    setCatalogError(""); setBranchError("");
    const stopProducts=subscribePublicBusinessCatalog(selected.id,(items)=>setProducts(items.filter((item)=>item.available!==false&&item.status!=="archived")),()=>{setProducts([]);setCatalogError("This catalogue could not be loaded. Try again.");});
    const stopBranches=subscribePublicBranches(selected.id,(items)=>{setBranches(items);setSelectedBranchId((current)=>items.some((branch)=>branch.id===current)?current:(items[0]?.id||""));},()=>{setBranches([]);setBranchError("Locations could not be loaded for this business.");});
    return()=>{stopProducts();stopBranches();};
  },[selected?.id]);
  useEffect(()=>user?.uid&&!user.isAnonymous?subscribeFavorites(user.uid,setFavorites,()=>{}):undefined,[user?.uid,user?.isAnonymous]);
  useEffect(()=>user?.uid&&!user.isAnonymous?subscribeCustomerOrders(user.uid,setOrders,()=>{}):undefined,[user?.uid,user?.isAnonymous]);
  useEffect(()=>{if(!requestedOrder||view!=="orders"||!orders.length)return;const timer=setTimeout(()=>orderRefs.current[requestedOrder]?.scrollIntoView({behavior:"smooth",block:"center"}),100);return()=>clearTimeout(timer);},[requestedOrder,view,orders]);

  const selectedBranch=branches.find((branch)=>branch.id===selectedBranchId);
  const acceptedCurrencies=useMemo(()=>branchAcceptedCurrencies(selectedBranch),[selectedBranch]);
  useEffect(()=>{if(selectedBranch&& !acceptedCurrencies.includes(currency))setCurrency(acceptedCurrencies[0]||"USD");},[selectedBranch, acceptedCurrencies, currency]);
  const businessResults=useMemo(()=>businesses.map((business)=>{const coords=business.coordinates||business.location||((Number.isFinite(Number(business.latitude))&&Number.isFinite(Number(business.longitude)))?{lat:Number(business.latitude),lng:Number(business.longitude)}:null);const distance=location.coordinates&&coords?distanceKm(location.coordinates,coords):null;return{business,distance};}).filter(({business,distance})=>{const cityMatch=!location.city||String(business.city||"").toLowerCase()===location.city.toLowerCase()||!business.city;const areaTerm=location.area.trim().toLowerCase();const areaMatch=!areaTerm||`${business.area||""} ${business.suburb||""} ${business.address||""}`.toLowerCase().includes(areaTerm);const radiusMatch=distance===null||distance<=Number(location.radiusKm||20);return cityMatch&&areaMatch&&radiusMatch;}).sort((a,b)=>(a.distance??9999)-(b.distance??9999)),[businesses,location]);
  const selectedArchetype=useMemo(()=>businessArchetype(selected||{}),[selected]);
  const selectedIsPickup=selectedArchetype.capabilities.includes("pickup_orders");
  const locationNoun=selectedArchetype.nouns.branch;
  const branchProducts=useMemo(()=>products.filter((product)=>!product.branchIds?.length||!selectedBranchId||product.branchIds.includes(selectedBranchId)).map((product)=>resolveProductForBranch(product,selectedBranchId)),[products,selectedBranchId]);
  const categories=useMemo(()=>[...new Set(branchProducts.map((product)=>product.category).filter(Boolean))].sort(),[branchProducts]);
  const visibleProducts=useMemo(()=>branchProducts.filter((product)=>{const matchesCategory=category==="all"||product.category===category;const term=productQuery.trim().toLowerCase();return matchesCategory&&(!term||`${product.name} ${product.description||""} ${product.category||""}`.toLowerCase().includes(term));}),[branchProducts,category,productQuery]);
  const cartItems=useMemo(()=>products.filter((product)=>cart[product.id]&&priceFor(product,currency)).map((product)=>({...product,quantity:cart[product.id]})),[cart,products,currency]);
  const cartTotal=cartItems.reduce((sum,item)=>sum+priceFor(item,currency)*item.quantity,0);
  const shownBusinesses=view==="saved"?businessResults.filter(({business})=>favorites.includes(business.id)):businessResults;

  function locate(){if(!navigator.geolocation){toast("Location is not supported in this browser.",{type:"error"});return;}setLocating(true);navigator.geolocation.getCurrentPosition((position)=>{setLocation((value)=>({...value,coordinates:{lat:position.coords.latitude,lng:position.coords.longitude}}));setLocating(false);},()=>{setLocating(false);toast("Your location could not be read. Choose an area instead.",{type:"error"});},{timeout:8000});}
  function changeQuantity(product,quantity){const max=Number(product.maxQuantity||99);setCart((current)=>({...current,[product.id]:Math.max(0,Math.min(max,quantity))}));}
  async function toggleFavorite(id){if(!user||user.isAnonymous)return window.location.assign(`/login?next=${encodeURIComponent("/marketplace?view=saved")}`);const next=!favorites.includes(id);setFavorites((current)=>next?[...current,id]:current.filter((item)=>item!==id));try{await saveFavorite(user.uid,id,next);}catch(error){toast(error.message,{type:"error"});}}
  async function payOrder(order){try{const response=await authenticatedFetch("/api/payments/paynow/initiate",{method:"POST",body:JSON.stringify({orderId:order.id,channel:"web"})});if(response.redirectUrl)window.location.assign(response.redirectUrl);}catch(error){toast(error.message,{type:"error"});}}
  function openBusiness(business){setSelected(business);setProductQuery("");setCategory("all");updateUrl("discover",{business:business.id,order:null});window.scrollTo({top:0,behavior:"smooth"});}
  function closeBusiness(){setSelected(null);updateUrl("discover",{business:null,order:null});}
  function requestBranchChange(id){if(id===selectedBranchId)return;if(cartItems.length)setPendingBranchId(id);else setSelectedBranchId(id);}
  function confirmBranchChange(){setCart({});setSelectedBranchId(pendingBranchId);setPendingBranchId("");}

  if(!authReady||!settingsReady)return <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]"><LoaderCircle className="h-8 w-8 animate-spin text-violet" /></div>;
  if(!allowed)return <MarketplaceGate privateBeta={settings.launch?.privateBetaEnabled} />;
  const tabItems=[{value:"discover",label:"Discover"},{value:"search",label:"Search"},{value:"orders",label:orders.length?`Orders (${orders.length})`:"Orders"},{value:"saved",label:"Saved"}];

  return <div className="min-h-screen bg-[var(--background)] text-[var(--text)]"><header className="sticky top-0 z-40 border-b border-[var(--border)]/80 bg-[var(--surface)]/94 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6"><Link href="/" className="flex items-center gap-3 font-semibold"><Image src="/brand/spotly.svg" alt="" width={40} height={40} className="h-10 w-10" /><span className="text-xl">Spotly</span></Link><div className="hidden flex-1 md:block"><SearchField value={query} onChange={(value)=>{setQuery(value);if(view!=="search")updateUrl("search");}} label="Search businesses" placeholder="Search businesses by name or category" /></div><select aria-label="Currency" value={currency} onChange={(event)=>setCurrency(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold">{(selectedBranch?acceptedCurrencies:settings.commerce?.currencies||["USD"]).map((item)=><option key={item} value={item}>{item==="ZWG"?"ZiG":item}</option>)}</select><Button asChild variant="outline" size="sm"><Link href={user&&!user.isAnonymous?"/account":"/login?next=/marketplace"}>{user&&!user.isAnonymous?profile?.displayName?.split(" ")[0]||"Account":"Sign in"}</Link></Button></div><div className="border-t border-[var(--border-subtle)] px-4 py-3 md:hidden"><SearchField value={query} onChange={(value)=>{setQuery(value);if(view!=="search")updateUrl("search");}} label="Search businesses" placeholder="Search businesses nearby" /></div></header><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-9"><div className="space-y-4 border-b pb-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><Tabs idPrefix={MARKETPLACE_TABS_ID} controlsPanels tabs={tabItems} value={view} onChange={(next)=>{setSelected(null);updateUrl(next,{business:null,order:next==="orders"?requestedOrder:null});}} label="Marketplace sections" /><p className="text-sm text-secondary">Pickup area: <strong>{location.area?`${location.area}, `:""}{location.city}</strong></p></div><LocationControl value={location} cities={launchCities} supportedAreas={settings.launch?.supportedAreas} onChange={setLocation} onLocate={locate} locating={locating} /></div>{view==="orders"&&!selected?<TabPanel idPrefix={MARKETPLACE_TABS_ID} value="orders" active className="mt-7"><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-violet">Your orders</p><h1 className="mt-2 text-3xl font-semibold">Pickup progress in one place</h1></div></div>{!user||user.isAnonymous?<EmptyState className="mt-6" icon={PackageCheck} title="Sign in to see your orders" description="Your orders are tied to your Spotly account." action={<Button asChild><Link href="/login?next=/marketplace?view=orders">Sign in</Link></Button>} />:orders.length?<div className="mt-6 grid gap-4 lg:grid-cols-2">{orders.map((order)=><OrderCard key={order.id} order={order} onPay={payOrder} highlighted={order.id===requestedOrder} innerRef={(node)=>{orderRefs.current[order.id]=node;}} />)}</div>:<EmptyState className="mt-6" icon={PackageCheck} title="No orders yet" description="Orders will appear here after checkout." action={<Button onClick={()=>updateUrl("discover")}>Browse businesses</Button>} />}</TabPanel>:selected?<section className="mt-7"><button type="button" onClick={closeBusiness} className="inline-flex items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft className="h-4 w-4" />Back to businesses</button><div className="mt-5 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center"><div className="relative h-20 w-20 overflow-hidden rounded-xl bg-[var(--surface-2)]"><BusinessVisual business={selected} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-[-.04em]">{selected.name}</h1>{["approved","verified"].includes(selected.verificationStatus)&&<Badge tone="success"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge>}</div><p className="mt-2 text-sm text-secondary">{selected.description||selected.category}</p></div><Link href={`/claim?business=${selected.id}`} className="text-sm font-semibold text-violet hover:underline">Manage or correct this listing</Link></div><div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]"><div>{branchError?<div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{branchError}</div>:branches.length?<div className="mb-6 rounded-xl border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--surface)] p-5"><div className="flex items-start gap-4"><MapPin className="mt-1 h-5 w-5 text-violet" /><div className="min-w-0 flex-1"><p className="font-semibold">Choose the exact {locationNoun}</p><p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Products, prices, currency and pickup availability can differ by location.</p><div className="mt-4 flex flex-wrap gap-2">{branches.map((branch)=>{const active=branch.id===selectedBranchId;const availability=pickupAvailability(branch);return <button key={branch.id} type="button" onClick={()=>requestBranchChange(branch.id)} className={cn("rounded-lg border px-4 py-3 text-left",active?"border-violet bg-[var(--accent-soft)] ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]":"hover:border-violet/40")}><span className="block text-sm font-semibold">{branch.branchName||branch.name||`Main ${locationNoun}`}</span><span className="mt-1 block text-xs text-[var(--text-3)]">{branch.city||"Zimbabwe"}{branch.address?` · ${branch.address}`:""}</span><span className={cn("mt-2 block text-xs font-semibold",availability.available?"text-success":"text-warning")}>{availability.available?`Earliest ${availability.earliest.date} ${availability.earliest.slot.label}`:availability.reason}</span></button>;})}</div></div></div></div>:<EmptyState icon={MapPin} title="No customer location is published" description="This business cannot accept an online pickup order until it publishes a location." />}{catalogError?<div role="alert" className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{catalogError}</div>:<><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-violet">{selectedArchetype.shortLabel}</p><h2 className="mt-2 text-2xl font-semibold">{selectedArchetype.nouns.catalog}</h2></div><p className="text-sm text-[var(--text-3)]">{visibleProducts.length} shown</p></div>{branchProducts.length>0&&<div className="mt-5 space-y-3"><SearchField value={productQuery} onChange={setProductQuery} label={`Search ${selectedArchetype.nouns.catalog}`} placeholder={`Search ${selectedArchetype.nouns.items}`} /><div className="no-scrollbar flex gap-2 overflow-x-auto pb-1"><button onClick={()=>setCategory("all")} className={cn("rounded-full border px-3 py-2 text-sm font-semibold",category==="all"?"border-violet bg-violet-soft text-violet-strong":"bg-[var(--surface)]")}>All</button>{categories.map((item)=><button key={item} onClick={()=>setCategory(item)} className={cn("rounded-full border px-3 py-2 text-sm font-semibold",category===item?"border-violet bg-violet-soft text-violet-strong":"bg-[var(--surface)]")}>{item}</button>)}</div></div>}{visibleProducts.length?<div className="mt-5 grid gap-3 xl:grid-cols-2">{visibleProducts.map((product)=><ProductCard key={product.id} product={product} quantity={cart[product.id]||0} onChange={changeQuantity} currency={currency} archetype={selectedArchetype} />)}</div>:branchProducts.length?<EmptyState className="mt-5" icon={Search} title="No matching products" description="Try another search or category." action={<Button variant="outline" onClick={()=>{setProductQuery("");setCategory("all");}}>Clear filters</Button>} />:<EmptyState className="mt-5" icon={Store} title={`${selectedArchetype.nouns.catalog} not available yet`} description={`This business has not published available ${selectedArchetype.nouns.items} for this location.`} action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="outline"><Link href="/support?topic=listing-update">Suggest an update</Link></Button><Button onClick={closeBusiness}>Browse similar businesses</Button></div>} />}</>}</div>{selectedIsPickup?<aside className="hidden h-fit rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:sticky lg:top-24 lg:block"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onCheckout={()=>setCheckout(true)} /></aside>:<aside className="h-fit rounded-xl border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--accent-soft)] p-5 lg:sticky lg:top-24"><ShieldCheck className="h-5 w-5 text-[var(--on-accent-soft)]" /><h2 className="mt-4 font-semibold">Online actions are not available yet</h2><p className="mt-2 text-sm leading-6 text-[color-mix(in_srgb,var(--on-accent-soft)_75%,transparent)]">You can review published information. This business has not enabled online {selectedArchetype.nouns.activity}.</p></aside>}</div></section>:<TabPanel idPrefix={MARKETPLACE_TABS_ID} value={view} active className="mt-7"><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-violet">{view==="saved"?"Your saved businesses":view==="search"?"Search results":"Nearby discovery"}</p><h1 className="mt-2 text-3xl font-semibold">{view==="saved"?"Businesses you want to revisit":query?`Results for “${query}”`:`Businesses in ${location.area?`${location.area}, `:""}${location.city}`}</h1></div><p className="hidden text-sm text-[var(--text-3)] sm:block">{shownBusinesses.length} shown</p></div>{loading?<div className="flex justify-center py-20"><LoaderCircle className="h-7 w-7 animate-spin text-violet" /></div>:loadError?<EmptyState className="mt-5" icon={Search} title="Businesses could not be loaded" description={loadError} action={<Button onClick={()=>setReloadKey((value)=>value+1)}>Try again</Button>} />:shownBusinesses.length?<div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shownBusinesses.map(({business,distance})=><BusinessCard key={business.id} business={business} distance={distance} favorite={favorites.includes(business.id)} onFavorite={toggleFavorite} onOpen={openBusiness} />)}</div>:view==="saved"?<EmptyState className="mt-5" icon={Heart} title="Nothing saved yet" description="Save a business to find it quickly later." action={<Button onClick={()=>updateUrl("discover")}>Browse businesses</Button>} />:<EmptyState className="mt-5" icon={Search} title={`No businesses found in ${location.area||location.city}`} description="Try a broader area, another city or add a missing business for review." action={<div className="flex gap-2"><Button variant="outline" onClick={()=>setLocation({...location,area:"",radiusKm:50})}>Broaden area</Button><Button asChild><Link href="/claim">Add a missing business</Link></Button></div>} />}</TabPanel>}</main><footer className="mt-16 border-t border-[var(--border)] bg-[var(--surface)]"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-[var(--text-3)] sm:flex-row sm:items-center sm:justify-between sm:px-6"><p>Spotly pickup pilot · availability comes from each location</p><div className="flex gap-4"><Link href="/claim">For businesses</Link><Link href="/support">Help</Link><Link href="/account">Account</Link></div></div></footer>{selectedIsPickup&&cartItems.length>0&&<button type="button" onClick={()=>setBasketOpen(true)} className="safe-bottom fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-3 text-left text-[var(--on-accent)] shadow-elevated lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)]/15"><ShoppingBasket className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{cartItems.reduce((sum,item)=>sum+item.quantity,0)} items</span><span className="block text-xs text-[color-mix(in_srgb,var(--on-accent)_70%,transparent)]">View basket</span></span><span className="font-semibold">{formatCurrency(cartTotal,currency)}</span></button>}<Overlay open={basketOpen} onClose={()=>setBasketOpen(false)} title="Your basket" description={`${cartItems.length} products`} mode="sheet"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onClose={()=>setBasketOpen(false)} onCheckout={()=>{setBasketOpen(false);setCheckout(true);}} /></Overlay><Modal open={Boolean(pendingBranchId)} onClose={()=>setPendingBranchId("")} title="Switch pickup location?" description="Products, prices and availability can differ by location." size="sm"><div className="p-5"><p className="text-sm leading-6 text-secondary">Switching will clear the current basket so you can build an accurate order for the new location.</p><div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={()=>setPendingBranchId("")}>Keep this location</Button><Button className="flex-1" onClick={confirmBranchChange}>Switch and clear</Button></div></div></Modal>{selectedIsPickup&&<CheckoutModal open={checkout} onClose={()=>setCheckout(false)} business={selected} branches={branches} selectedBranchId={selectedBranchId} cartItems={cartItems} currency={currency} user={user} onComplete={(order)=>{setCart({});removeState(CART_KEY,user);updateUrl("orders",{order:order.orderId||order.id,business:null});}} />}</div>;
}
