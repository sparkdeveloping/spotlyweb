"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BadgeCheck, ChevronRight, CreditCard, Heart, LoaderCircle, LocateFixed, MapPin, Minus, PackageCheck, Plus, RefreshCw, Search, ShieldCheck, ShoppingBasket, Store, Truck, X } from "lucide-react";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import { useToast } from "@/components/providers";
import { Badge, Button, Card, EmptyState, Modal, Overlay, SearchField, StatusBadge } from "@/components/ui";
import { authenticatedFetch } from "@/lib/api-client";
import { loadPublicMarketplaceBusiness, saveFavorite, searchLiveBusinesses, subscribeCustomerOrders, subscribeFavorites, track } from "@/lib/firebase-services";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { businessArchetype } from "@/data/business-archetypes";
import { migrateLegacyState, readState, removeState, writeState } from "@/lib/browser-state";
import { branchAcceptedCurrencies, branchPaymentMethods, pickupAvailability } from "@/lib/pickup-availability";
import { NotificationBell } from "@/components/notification-center";
import { LottieEmptyState, SpotlyLottie } from "@/components/spotly-lottie";
import { resolveProductForBranch } from "@/lib/product-offers";
import { MARKETPLACE_SERVICE_KEYS, MarketplaceHome, ServiceModeHeader, serviceMatchesBusiness } from "@/components/marketplace-home";

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
  return <main className="min-h-screen bg-[var(--background)] px-4 py-16 text-[var(--text)] sm:px-6"><div className="mx-auto max-w-3xl rounded-[20px] border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--surface)] p-7 text-center sm:p-12"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[26px] bg-[var(--accent-soft)]"><SpotlyLottie name="marketplace-discover" mode="loop" eager className="h-20 w-20" fallback={<ShoppingBasket className="h-8 w-8 text-[var(--on-accent-soft)]" />} /></div><Badge tone="purple" className="mt-6">Controlled rollout</Badge><h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Customer ordering is opening by area.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-2)]">Verified businesses and locations become available when their pickup or delivery operations are ready. {privateBeta ? "This account does not currently have preview access." : "Ordering is currently paused in this area."}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/">Join the launch list</Link></Button><Button asChild variant="outline"><Link href="/claim">Find or add a business</Link></Button><Button asChild variant="ghost"><Link href="/support">Get help</Link></Button></div></div></main>;
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
  const canOrder = archetype.capabilities.includes("pickup_orders");
  const cta = archetype.id === "restaurant_food" ? "View menu" : archetype.id === "grocery_retail" ? "Shop this business" : archetype.id === "ticketing_events" ? "View events" : archetype.id === "appointments_services" ? "View services" : archetype.id === "accommodation_activities" ? "View listings" : "View details";
  const capabilityLabel = canOrder ? "Online ordering" : archetype.id === "ticketing_events" ? "Events" : archetype.id === "appointments_services" ? "Services" : archetype.id === "accommodation_activities" ? "Bookings profile" : "Business profile";

  return <article className="overflow-hidden rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] hover:shadow-card"><button onClick={() => onOpen(business)} className="block w-full text-left"><div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-2)]"><BusinessVisual business={business} /><div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-transparent" /><div className="absolute bottom-3 left-3 flex flex-wrap gap-2"><Badge className="bg-[var(--surface)]/95 text-[var(--text)] ring-0">{business.category || archetype.shortLabel}</Badge>{verified && <Badge className="bg-[var(--success)] text-[var(--on-success)] ring-0"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge>}</div></div><div className="p-5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold tracking-[-.025em]">{business.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-[var(--text-3)]"><MapPin className="h-4 w-4" />{distance !== null ? `${distance.toFixed(1)} km away` : locationCount ? `${locationCount} ${archetype.nouns.branch}${locationCount === 1 ? "" : "s"}` : business.area || business.city || "Location not provided"}</p></div><ChevronRight className="mt-1 h-5 w-5 text-[var(--text-3)]" /></div><p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-2)]">{business.description || `View ${archetype.nouns.catalog.toLowerCase()}, locations and currently published information.`}</p><div className="mt-4 flex flex-wrap gap-2"><Badge tone="neutral">{capabilityLabel}</Badge>{locationCount > 0 && <Badge tone="neutral"><MapPin className="mr-1 h-3.5 w-3.5" />{locationCount} {locationCount === 1 ? "location" : "locations"}</Badge>}{canOrder && <Badge tone="neutral"><Truck className="mr-1 h-3.5 w-3.5" />Pickup / delivery by location</Badge>}</div></div></button><div className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3"><Button onClick={() => onOpen(business)} className="flex-1" size="sm">{cta}</Button><Button onClick={() => onFavorite(business.id)} size="icon" variant="outline" aria-label={favorite ? "Remove from saved" : "Save business"}><Heart className={cn("h-5 w-5", favorite && "fill-[var(--danger)] text-[var(--danger)]")} /></Button></div></article>;
}

function ProductCard({ product, quantity, onChange, currency, archetype }) {
  const reduce = useReducedMotion();
  const price = priceFor(product, currency);
  const unavailable = product.available === false || product.active === false || product.stockStatus === "out_of_stock";
  return <motion.div layout whileHover={reduce ? undefined : { y: -3 }} transition={{ duration: .18 }}><Card className="flex gap-4 p-4" variant="bordered"><div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">{product.image ? <Image src={product.image} alt="" fill unoptimized className="object-cover" sizes="96px" /> : <div className="flex h-full items-center justify-center text-[var(--text-3)]"><ShoppingBasket className="h-8 w-8" /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm text-secondary">{[product.unit, product.packSize, product.description || product.category || `Available ${archetype.capabilities.includes("pickup_orders") ? "for pickup" : "from this business"}`].filter(Boolean).join(" · ")}</p></div><p className={cn("shrink-0 font-semibold", !price && "text-warning")}>{price ? formatCurrency(price, currency) : `Not available in ${currency}`}</p></div><div className="mt-4 flex items-center justify-between gap-3">{unavailable ? <Badge tone="neutral">Unavailable</Badge> : product.stockQuantity > 0 ? <span className="text-xs text-secondary">{product.stockQuantity} available</span> : <span />}<AnimatePresence mode="popLayout" initial={false}>{quantity ? <motion.div key="quantity" initial={reduce ? false : { opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: .94 }} className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"><motion.button whileTap={reduce ? undefined : { scale: .9 }} onClick={() => onChange(product, quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--surface-hover)]" aria-label={`Decrease ${product.name}`}><Minus className="h-4 w-4" /></motion.button><motion.span key={quantity} initial={reduce ? false : { y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-9 text-center text-sm font-semibold">{quantity}</motion.span><motion.button whileTap={reduce ? undefined : { scale: .9 }} disabled={!price || unavailable || (product.maxQuantity && quantity >= product.maxQuantity)} onClick={() => onChange(product, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-md bg-violet text-[var(--on-accent)] disabled:opacity-40" aria-label={`Increase ${product.name}`}><Plus className="h-4 w-4" /></motion.button></motion.div> : <motion.div key="add" initial={reduce ? false : { opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: .94 }}><Button size="sm" disabled={!price || unavailable} onClick={() => onChange(product, 1)}>{price ? <SpotlyLottie name="basket-add" mode="hover" className="h-5 w-5" fallback={<Plus className="h-4 w-4" />} /> : <Plus className="h-4 w-4" />}{price ? "Add to basket" : "Price unavailable"}</Button></motion.div>}</AnimatePresence></div></div></Card></motion.div>;
}

function OrderCard({ order, onPay, highlighted = false, innerRef }) {
  const created = timestamp(order.createdAt);
  const paymentNeeded = ["unpaid", "pending"].includes(order.paymentStatus);
  const [delivery, setDelivery] = useState(null);
  useEffect(() => {
    let active = true;
    if (order.fulfilment !== "delivery" || !order.id) { setDelivery(null); return undefined; }
    authenticatedFetch(`/api/orders/delivery-status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" }).then((value) => { if (active) setDelivery(value.delivery || null); }).catch(() => {});
    const timer = setInterval(() => authenticatedFetch(`/api/orders/delivery-status?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" }).then((value) => { if (active) setDelivery(value.delivery || null); }).catch(() => {}), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [order.id, order.fulfilment]);
  const deliveryLabel = { awaiting_dispatch: "Business is preparing", searching_driver: "Finding your Driver", driver_assigned: "Driver assigned", driver_to_pickup: "Driver is going to the shop", driver_arrived_pickup: "Driver is at the shop", pickup_verification: "Pickup is being verified", collected: "Driver has your order", en_route: "Driver is on the way", driver_arrived_customer: "Driver has arrived", handoff_verification: "Confirming delivery", delivered: "Delivered" }[delivery?.state] || String(delivery?.state || order.deliveryStatus || "Business is preparing").replaceAll("_", " ");
  return <div ref={innerRef}><Card className={cn("p-5 transition", highlighted && "border-violet ring-4 ring-violet/10")}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[.08em] text-[var(--text-3)]">{order.number || order.id}</p><h3 className="mt-2 text-lg font-semibold">{order.businessName || "Spotly order"}</h3><p className="mt-1 text-sm text-secondary">{created ? created.toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" }) : "Just now"}</p></div><div className="text-right"><StatusBadge status={order.status || "submitted"} /><p className="mt-3 font-semibold">{formatCurrency(order.totals?.total || 0, order.currency)}</p></div></div>{order.fulfilment === "delivery" ? <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold capitalize">{deliveryLabel}</p>{delivery?.number && <Badge tone="info">{delivery.number}</Badge>}</div><p className="mt-1 text-[var(--text-2)]">{order.delivery?.suburb || order.delivery?.address || "Delivery address"}</p>{delivery?.customerPin && !["delivered","cancelled","failed","returned"].includes(delivery.state) && <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-xs font-semibold text-tertiary">YOUR DELIVERY PIN</p><p className="mt-1 font-mono text-2xl font-semibold tracking-[.18em]">{delivery.customerPin}</p><p className="mt-1 text-xs text-secondary">Only tell the Driver this PIN when they are with you and ready to hand over the order.</p></div>}</div> : <div className="mt-4 rounded-lg bg-[var(--surface-2)] p-4 text-sm"><p className="font-semibold">Pickup: {order.pickup?.date || "To be confirmed"} · {order.pickup?.slot || "Time pending"}</p><p className="mt-1 text-[var(--text-2)]">{order.branchName || "Pickup location"}</p></div>}{paymentNeeded && <Button className="mt-4 w-full" onClick={() => onPay(order)}><CreditCard className="h-4 w-4" />Continue payment</Button>}</Card></div>;
}
function BasketContents({ cartItems, cartTotal, currency, onCheckout, onClose }) {
  const reduce = useReducedMotion();
  return <div className="p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Your basket</h2><p className="mt-1 text-xs text-secondary">Built for this exact business location</p></div>{onClose && <button onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" aria-label="Close basket"><X className="h-5 w-5" /></button>}</div>{cartItems.length ? <><div className="mt-5 space-y-3"><AnimatePresence initial={false}>{cartItems.map((item) => <motion.div layout key={item.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, x: 12 }} className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-sm"><motion.span key={item.quantity} initial={reduce ? false : { scale: .8 }} animate={{ scale: 1 }} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-semibold text-[var(--on-accent-soft)]">{item.quantity}</motion.span><span className="min-w-0 flex-1 truncate font-medium">{item.name}</span><span className="font-semibold">{formatCurrency(priceFor(item, currency) * item.quantity, currency)}</span></motion.div>)}</AnimatePresence></div><div className="my-5 border-t" /><div className="flex items-center justify-between text-lg font-semibold"><span>Subtotal</span><span>{formatCurrency(cartTotal, currency)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--text-3)]">Pickup and delivery availability come from the exact location you choose.</p><Button className="mt-5 w-full" onClick={onCheckout}>Choose pickup or delivery<ChevronRight className="h-4 w-4" /></Button></> : <div className="py-7 text-center"><SpotlyLottie name="empty-basket" mode="loop" className="mx-auto h-24 w-24" ariaLabel="Empty basket" /><p className="mt-2 text-sm font-semibold">Your basket is ready when you are</p><p className="mx-auto mt-2 max-w-[240px] text-xs leading-5 text-secondary">Add a product and Spotly will keep the basket tied to this location's prices and availability.</p></div>}</div>;
}

function CheckoutModal({ open, onClose, business, branches, selectedBranchId, cartItems, currency, user, onComplete }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ checkoutId: "", branchId: "", fulfilment: "pickup", date: "", slot: "", slotId: "", paymentMethod: "", contactName: user?.displayName || "", contactPhone: user?.phoneNumber || "", alternativePhone: "", notes: "", substitutionPreference: "contact_me", address: "", suburb: "", landmark: "", instructions: "", lat: null, lng: null });
  const selectedBranch = branches.find((branch) => branch.id === form.branchId);
  const deliveryEnabled = Boolean(selectedBranch?.delivery?.enabled && !selectedBranch?.delivery?.paused && (selectedBranch?.fulfilment || []).includes("delivery"));
  const availability = useMemo(() => pickupAvailability(selectedBranch), [selectedBranch]);
  const methods = useMemo(() => branchPaymentMethods(selectedBranch).filter((method) => form.fulfilment !== "delivery" || !["cash", "bank_transfer"].includes(method)), [selectedBranch, form.fulfilment]);
  const total = cartItems.reduce((sum, item) => sum + (priceFor(item, currency) || 0) * item.quantity, 0);
  const deliveryFee = form.fulfilment === "delivery" ? Number(selectedBranch?.delivery?.fee ?? 3.5) : 0;
  const unresolvedPrice = cartItems.some((item) => !priceFor(item, currency));
  const steps = ["Basket", "How to get it", form.fulfilment === "delivery" ? "Delivery details" : "Pickup details", "Payment", "Review"];

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
    const nextAvailability = pickupAvailability(selectedBranch);
    setForm((current) => {
      const nextFulfilment = current.fulfilment === "delivery" && !deliveryEnabled ? "pickup" : current.fulfilment;
      const validDay = nextAvailability.days.find((day) => day.date === current.date);
      const validSlot = validDay?.slots.find((slot) => slot.label === current.slot);
      const allowedMethods = branchPaymentMethods(selectedBranch).filter((method) => nextFulfilment !== "delivery" || method !== "cash");
      const method = allowedMethods.includes(current.paymentMethod) ? current.paymentMethod : allowedMethods[0] || "";
      const chosenSlot = validSlot || nextAvailability.earliest?.slot || null;
      return { ...current, fulfilment: nextFulfilment, date: validDay ? current.date : nextAvailability.earliest?.date || "", slot: chosenSlot?.label || "", slotId: chosenSlot?.id || "", paymentMethod: method };
    });
  }, [selectedBranch, deliveryEnabled]);

  const day = availability.days.find((item) => item.date === form.date);
  function validationFor(currentStep) {
    if (unresolvedPrice) return "One or more items do not have a valid price in the selected currency.";
    if (currentStep >= 1 && !form.branchId) return "Choose a business location.";
    if (currentStep >= 1 && form.fulfilment === "delivery" && !deliveryEnabled) return "Delivery is not currently enabled for this location.";
    if (currentStep === 2 && form.fulfilment === "pickup" && !availability.available) return availability.reason;
    if (currentStep === 2 && form.fulfilment === "pickup" && (!form.date || !form.slot)) return "Choose an available pickup date and time.";
    if (currentStep === 2 && form.fulfilment === "delivery" && (!form.address.trim() || !Number.isFinite(Number(form.lat)) || !Number.isFinite(Number(form.lng)))) return "Add the delivery address and set its map location.";
    if (currentStep === 2 && !form.contactName.trim()) return `Enter the ${form.fulfilment === "delivery" ? "delivery" : "pickup"} contact name.`;
    if (currentStep === 2 && !/^\+?[0-9\s-]{7,18}$/.test(form.contactPhone.trim())) return "Enter a valid phone number.";
    if (currentStep === 3 && !form.paymentMethod) return "This location has not configured a payment method for checkout.";
    return "";
  }
  function next() { const message = validationFor(step); if (message) { setError(message); return; } setError(""); setStep((value) => Math.min(4, value + 1)); }
  function useCurrentLocation() {
    if (!navigator.geolocation) { setError("Location is not supported in this browser. Enter an address and use a device with location access."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      setForm((current) => ({ ...current, lat: position.coords.latitude, lng: position.coords.longitude }));
      setLocating(false);
    }, () => { setLocating(false); setError("We could not read your location. Allow location access and try again."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }
  async function submit() {
    const message = validationFor(4); if (message) { setError(message); return; }
    if (!user || user.isAnonymous) { window.location.assign(`/login?next=${encodeURIComponent("/marketplace")}`); return; }
    setSubmitting(true); setError("");
    try {
      const payload = { checkoutId: form.checkoutId, businessId: business.id, branchId: form.branchId, items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })), currency, paymentMethod: form.paymentMethod, fulfilment: form.fulfilment };
      if (form.fulfilment === "pickup") payload.pickup = { date: form.date, slot: form.slot, slotId: form.slotId, contactName: form.contactName, contactPhone: form.contactPhone, alternativePhone: form.alternativePhone, notes: form.notes, substitutionPreference: form.substitutionPreference };
      else payload.delivery = { contactName: form.contactName, contactPhone: form.contactPhone, address: form.address, suburb: form.suburb, landmark: form.landmark, instructions: form.instructions, lat: Number(form.lat), lng: Number(form.lng), substitutionPreference: form.substitutionPreference };
      const order = await authenticatedFetch("/api/orders/create", { method: "POST", body: JSON.stringify(payload) });
      if (order.paymentRequired) {
        const channel = ["ecocash", "onemoney"].includes(form.paymentMethod) ? form.paymentMethod : "web";
        const payment = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.orderId, channel, phone: form.contactPhone }) });
        if (payment.redirectUrl) window.location.assign(payment.redirectUrl); else toast(payment.instructions || "Payment request sent.", { type: "success" });
      } else toast(form.fulfilment === "delivery" ? "Order placed. The business will prepare it for delivery." : "Order placed. The business will confirm your pickup.", { type: "success" });
      removeState(CHECKOUT_KEY, user); setStep(0); onComplete(order); onClose();
    } catch (submissionError) { setError(submissionError.message || "The order could not be placed. Try again."); }
    finally { setSubmitting(false); }
  }
  const field = (key) => ({ value: form[key] ?? "", onChange: (event) => setForm({ ...form, [key]: event.target.value }) });
  return <Modal open={open} onClose={onClose} title="Complete your order" description={`Step ${step + 1} of ${steps.length}: ${steps[step]}`} size="lg"><div className="border-b px-5 py-4"><div className="flex gap-2">{steps.map((label, index) => <div key={label} className="min-w-0 flex-1"><div className={cn("h-1.5 rounded-full", index <= step ? "bg-violet" : "bg-[var(--border)]")} /><p className={cn("mt-2 hidden text-xs sm:block", index === step ? "font-semibold text-violet" : "text-[var(--text-3)]")}>{label}</p></div>)}</div></div><div className="min-h-[380px] p-5 sm:p-6">{error && <div role="alert" className="mb-5 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-3 text-sm text-[var(--on-danger-soft)]">{error}</div>}
  {step === 0 && <div><div className="rounded-lg bg-[var(--accent-soft)] p-4"><p className="font-semibold">{business?.name}</p><p className="mt-1 text-sm text-[var(--on-accent-soft)]">{cartItems.reduce((sum,item) => sum + item.quantity,0)} items · {formatCurrency(total,currency)}</p></div><div className="mt-5 divide-y">{cartItems.map((item) => <div key={item.id} className="flex gap-3 py-3 text-sm"><span className="font-semibold">{item.quantity}×</span><span className="flex-1">{item.name}</span><span className="font-semibold">{priceFor(item,currency) ? formatCurrency(priceFor(item,currency)*item.quantity,currency) : "Price unavailable"}</span></div>)}</div></div>}
  {step === 1 && <div className="space-y-5"><label className="text-sm font-medium">Business location<select {...field("branchId")} className="field-control mt-2 w-full">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName || branch.name || "Main location"} · {branch.city || "Zimbabwe"}</option>)}</select></label><div><p className="text-sm font-medium">How do you want it?</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setForm((current) => ({ ...current, fulfilment: "pickup" }))} className={cn("rounded-xl border p-4 text-left", form.fulfilment === "pickup" ? "border-violet bg-violet-soft ring-2 ring-violet/10" : "bg-[var(--surface)]")}><PackageCheck className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold">Pick up</p><p className="mt-1 text-sm text-secondary">Choose a time and collect from the business.</p></button><button type="button" disabled={!deliveryEnabled} onClick={() => setForm((current) => ({ ...current, fulfilment: "delivery" }))} className={cn("rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50", form.fulfilment === "delivery" ? "border-violet bg-violet-soft ring-2 ring-violet/10" : "bg-[var(--surface)]")}><MapPin className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold">Delivery</p><p className="mt-1 text-sm text-secondary">{deliveryEnabled ? `Delivered from ${selectedBranch?.branchName || selectedBranch?.name || "this location"}.` : "Delivery is not enabled at this location yet."}</p></button></div></div></div>}
  {step === 2 && form.fulfilment === "pickup" && <div className="space-y-5">{availability.available ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Pickup day<select value={form.date} onChange={(event) => { const nextDay = availability.days.find((item) => item.date === event.target.value); const nextSlot = nextDay?.slots?.[0] || null; setForm({ ...form, date: event.target.value, slotId: nextSlot?.id || "", slot: nextSlot?.label || "" }); }} className="field-control mt-2 w-full">{availability.days.map((item) => <option key={item.date} value={item.date}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Pickup time<select value={form.slotId} onChange={(event) => { const selected = day?.slots.find((slot) => slot.id === event.target.value); setForm({ ...form, slotId: selected?.id || "", slot: selected?.label || "" }); }} className="field-control mt-2 w-full">{(day?.slots || []).map((slot) => <option key={slot.id} value={slot.id}>{slot.label}{slot.remaining <= 3 ? ` · ${slot.remaining} left` : ""}</option>)}</select></label></div> : <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm text-[var(--on-warning-soft)]"><p className="font-semibold">Pickup is not available for online checkout.</p><p className="mt-1">{availability.reason}</p></div>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Pickup contact name<input {...field("contactName")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Phone<input {...field("contactPhone")} className="field-control mt-2 w-full" placeholder="+263" /></label><label className="text-sm font-medium sm:col-span-2">Pickup notes <span className="font-normal text-tertiary">optional</span><textarea {...field("notes")} className="field-control mt-2 min-h-24 w-full" /></label></div></div>}
  {step === 2 && form.fulfilment === "delivery" && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Delivery address<input {...field("address")} className="field-control mt-2 w-full" placeholder="Street / complex / house" /></label><label className="text-sm font-medium">Area or suburb<input {...field("suburb")} className="field-control mt-2 w-full" placeholder="Highlands" /></label><label className="text-sm font-medium">Landmark <span className="font-normal text-tertiary">optional</span><input {...field("landmark")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Delivery contact name<input {...field("contactName")} className="field-control mt-2 w-full" /></label><label className="text-sm font-medium">Phone<input {...field("contactPhone")} className="field-control mt-2 w-full" placeholder="+263" /></label><label className="text-sm font-medium sm:col-span-2">Delivery instructions <span className="font-normal text-tertiary">optional</span><textarea {...field("instructions")} className="field-control mt-2 min-h-24 w-full" placeholder="Gate, entrance, landmark or handoff instructions" /></label></div><div className="rounded-xl border bg-[var(--surface-2)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">Set the delivery pin</p><p className="mt-1 text-sm text-secondary">Spotly uses the map location for dispatch and Driver navigation.</p>{Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) && <p className="mt-2 text-xs font-semibold text-success">Location set · {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}</p>}</div><Button type="button" variant="outline" onClick={useCurrentLocation} loading={locating}><LocateFixed className="h-4 w-4" />Use my location</Button></div></div></div>}
  {step === 3 && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">{methods.map((method) => <button type="button" key={method} onClick={() => setForm((current) => ({ ...current, paymentMethod: method }))} className={cn("rounded-xl border p-4 text-left", form.paymentMethod === method ? "border-violet bg-violet-soft ring-2 ring-violet/10" : "bg-[var(--surface)]")}><CreditCard className="h-5 w-5 text-violet" /><p className="mt-3 font-semibold">{method.replaceAll("_", " ")}</p></button>)}</div>{form.fulfilment === "delivery" && <p className="text-sm text-secondary">Cash on delivery is intentionally unavailable. Choose a supported digital payment method.</p>}</div>}
  {step === 4 && <div className="space-y-4"><div className="rounded-xl border p-5"><p className="text-sm font-semibold text-violet">{form.fulfilment === "delivery" ? "Delivery" : "Pickup"}</p><h3 className="mt-2 text-xl font-semibold">{selectedBranch?.branchName || selectedBranch?.name || business?.name}</h3><p className="mt-2 text-sm text-secondary">{form.fulfilment === "delivery" ? `${form.address}${form.suburb ? ` · ${form.suburb}` : ""}` : `${form.date} · ${form.slot}`}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-5 text-sm"><div className="flex justify-between"><span>Items</span><span className="font-semibold">{formatCurrency(total,currency)}</span></div>{form.fulfilment === "delivery" && <div className="mt-2 flex justify-between"><span>Delivery</span><span className="font-semibold">{formatCurrency(deliveryFee,currency)}</span></div>}<div className="mt-3 flex justify-between border-t pt-3 text-base"><span className="font-semibold">Estimated total</span><span className="font-semibold">{formatCurrency(total + deliveryFee,currency)}</span></div></div><p className="text-xs leading-5 text-tertiary">The server verifies product prices, fees, branch availability and fulfilment before creating the order.</p></div>}
  </div><div className="flex items-center justify-between gap-3 border-t p-5"><Button variant="outline" onClick={() => step ? setStep((value) => value - 1) : onClose()}>{step ? "Back" : "Cancel"}</Button>{step < 4 ? <Button onClick={next}>{step === 0 ? "Choose fulfilment" : step === 1 ? (form.fulfilment === "delivery" ? "Add delivery details" : "Choose fulfilment") : step === 2 ? "Choose payment" : "Review order"}</Button> : <Button onClick={submit} loading={submitting}>Place {form.fulfilment === "delivery" ? "delivery" : "pickup"} order</Button>}</div></Modal>;
}


function normalizeMarketplaceView(value) {
  if (value === "orders") return "activity";
  if (value === "discover") return "home";
  return ["home", "search", "activity", "saved"].includes(value) ? value : "home";
}

export function MarketplaceApp({ basePath = "/marketplace", initialService = null }) {
  const { user, profile, authReady } = useAuth();
  const { settings, settingsReady } = usePlatform();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderRefs = useRef({});

  const requestedView = searchParams.get("view");
  const requestedOrder = searchParams.get("order");
  const requestedBusiness = searchParams.get("business");
  const requestedService = searchParams.get("service");
  const launchCities = settings.launch?.launchCities?.length ? settings.launch.launchCities : ["Harare"];
  const defaultLocation = { city: settings.launch?.primaryCity || launchCities[0], area: "", radiusKm: 20, coordinates: null };

  const [location, setLocation] = useState(defaultLocation);
  const [locating, setLocating] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
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
  const [view, setView] = useState(requestedOrder ? "activity" : normalizeMarketplaceView(requestedView));
  const [service, setService] = useState(MARKETPLACE_SERVICE_KEYS.has(requestedService) ? requestedService : MARKETPLACE_SERVICE_KEYS.has(initialService) ? initialService : null);
  const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [branchError, setBranchError] = useState("");
  const [businessDetailLoading, setBusinessDetailLoading] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [reloadKey, setReloadKey] = useState(0);

  const maintenance = settings.launch?.publicMode === "maintenance";
  const ridesEnabled = settings.mobility?.ridesEnabled === true || settings.launch?.ridesEnabled === true;
  const sendEnabled = settings.commerce?.peerDeliveryEnabled === true || settings.launch?.sendEnabled === true;

  function routeFor(params) {
    const queryString = params.toString();
    const root = basePath || "/";
    return queryString ? `${root}?${queryString}` : root;
  }

  function updateUrl(nextView, extras = {}) {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = normalizeMarketplaceView(nextView);
    if (normalized === "home") params.delete("view"); else params.set("view", normalized);
    if (extras.order === null) params.delete("order"); else if (extras.order) params.set("order", extras.order);
    if (extras.business === null) params.delete("business"); else if (extras.business) params.set("business", extras.business);
    if (extras.service === null) params.delete("service"); else if (extras.service) params.set("service", extras.service);
    router.push(routeFor(params), { scroll: false });
    setView(normalized);
    if (Object.prototype.hasOwnProperty.call(extras, "service")) setService(MARKETPLACE_SERVICE_KEYS.has(extras.service) ? extras.service : null);
  }

  function openHome() {
    setSelected(null);
    setQuery("");
    updateUrl("home", { business: null, order: null, service: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function enterService(nextService) {
    setSelected(null);
    setQuery("");
    updateUrl("home", { business: null, order: null, service: nextService });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSearch() {
    setSelected(null);
    updateUrl("search", { business: null, order: null, service });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    setView(requestedOrder ? "activity" : normalizeMarketplaceView(requestedView));
  }, [requestedView, requestedOrder]);

  useEffect(() => {
    const nextService = MARKETPLACE_SERVICE_KEYS.has(requestedService) ? requestedService : MARKETPLACE_SERVICE_KEYS.has(initialService) ? initialService : null;
    setService(nextService);
  }, [requestedService, initialService]);

  useEffect(() => {
    const migratedCart = migrateLegacyState(CART_KEY, user);
    setCart(migratedCart || readState(CART_KEY, user, {}));
    setLocation(migrateLegacyState(LOCATION_KEY, user) || readState(LOCATION_KEY, user, defaultLocation));
  }, [user]);

  useEffect(() => { writeState(CART_KEY, user, cart); }, [cart, user]);
  useEffect(() => { writeState(LOCATION_KEY, user, location); }, [location, user]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchLiveBusinesses(query, 100, { city: location.city });
        if (active) {
          setBusinesses(result);
          setLoadError("");
        }
      } catch {
        if (active) setLoadError("Spotly could not refresh nearby businesses. You can keep using the last loaded results, or retry.");
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [location.city, query, reloadKey]);

  useEffect(() => {
    if (!requestedBusiness || selected || !businesses.length) return;
    const found = businesses.find((business) => business.id === requestedBusiness);
    if (found) setSelected(found);
  }, [requestedBusiness, businesses, selected]);

  useEffect(() => {
    let active = true;
    if (!selected?.id) {
      setProducts([]);
      setBranches([]);
      setSelectedBranchId("");
      setBusinessDetailLoading(false);
      return () => { active = false; };
    }
    setCatalogError("");
    setBranchError("");
    setBusinessDetailLoading(true);
    loadPublicMarketplaceBusiness(selected.id).then((result) => {
      if (!active) return;
      const nextProducts = (result.products || []).filter((item) => item.available !== false && item.status !== "archived");
      const nextBranches = result.branches || [];
      setProducts(nextProducts);
      setBranches(nextBranches);
      setSelectedBranchId((current) => nextBranches.some((branch) => branch.id === current) ? current : (nextBranches[0]?.id || ""));
      setBusinessDetailLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setProducts([]);
      setBranches([]);
      setSelectedBranchId("");
      setCatalogError(reason.message || "This catalogue could not be loaded.");
      setBranchError(reason.message || "Locations could not be loaded for this business.");
      setBusinessDetailLoading(false);
    });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => user?.uid && !user.isAnonymous ? subscribeFavorites(user.uid, setFavorites, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => user?.uid && !user.isAnonymous ? subscribeCustomerOrders(user.uid, setOrders, () => {}) : undefined, [user?.uid, user?.isAnonymous]);
  useEffect(() => {
    if (!requestedOrder || view !== "activity" || !orders.length) return;
    const timer = setTimeout(() => orderRefs.current[requestedOrder]?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    return () => clearTimeout(timer);
  }, [requestedOrder, view, orders]);

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
  const acceptedCurrencies = useMemo(() => branchAcceptedCurrencies(selectedBranch), [selectedBranch]);
  useEffect(() => {
    if (selectedBranch && !acceptedCurrencies.includes(currency)) setCurrency(acceptedCurrencies[0] || "USD");
  }, [selectedBranch, acceptedCurrencies, currency]);

  const businessResults = useMemo(() => businesses.map((business) => {
    const coords = business.coordinates || business.location || ((Number.isFinite(Number(business.latitude)) && Number.isFinite(Number(business.longitude))) ? { lat: Number(business.latitude), lng: Number(business.longitude) } : null);
    const distance = location.coordinates && coords ? distanceKm(location.coordinates, coords) : null;
    return { business, distance };
  }).filter(({ business, distance }) => {
    const cityMatch = !location.city || String(business.city || "").toLowerCase() === location.city.toLowerCase() || !business.city;
    const areaTerm = location.area.trim().toLowerCase();
    const areaMatch = !areaTerm || `${business.area || ""} ${business.suburb || ""} ${business.address || ""}`.toLowerCase().includes(areaTerm);
    const radiusMatch = distance === null || distance <= Number(location.radiusKm || 20);
    return cityMatch && areaMatch && radiusMatch;
  }).sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999)), [businesses, location]);

  const serviceResults = useMemo(() => {
    if (!["eat", "shop", "book", "events"].includes(service)) return businessResults;
    return businessResults.filter(({ business }) => serviceMatchesBusiness(service, business));
  }, [businessResults, service]);

  const selectedArchetype = useMemo(() => businessArchetype(selected || {}), [selected]);
  const selectedIsPickup = selectedArchetype.capabilities.includes("pickup_orders");
  const locationNoun = selectedArchetype.nouns.branch;
  const branchProducts = useMemo(() => products.filter((product) => !product.branchIds?.length || !selectedBranchId || product.branchIds.includes(selectedBranchId)).map((product) => resolveProductForBranch(product, selectedBranchId)), [products, selectedBranchId]);
  const categories = useMemo(() => [...new Set(branchProducts.map((product) => product.category).filter(Boolean))].sort(), [branchProducts]);
  const visibleProducts = useMemo(() => branchProducts.filter((product) => {
    const matchesCategory = category === "all" || product.category === category;
    const term = productQuery.trim().toLowerCase();
    return matchesCategory && (!term || `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase().includes(term));
  }), [branchProducts, category, productQuery]);
  const cartItems = useMemo(() => products.filter((product) => cart[product.id] && priceFor(product, currency)).map((product) => ({ ...product, quantity: cart[product.id] })), [cart, products, currency]);
  const cartTotal = cartItems.reduce((sum, item) => sum + priceFor(item, currency) * item.quantity, 0);
  const shownBusinesses = view === "saved" ? businessResults.filter(({ business }) => favorites.includes(business.id)) : serviceResults;

  function locate() {
    if (!navigator.geolocation) {
      toast("Location is not supported in this browser.", { type: "error" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation((value) => ({ ...value, coordinates: { lat: position.coords.latitude, lng: position.coords.longitude } }));
      setLocating(false);
    }, () => {
      setLocating(false);
      toast("Your location could not be read. Choose an area instead.", { type: "error" });
    }, { timeout: 8000 });
  }

  function changeQuantity(product, quantity) {
    const max = Number(product.maxQuantity || 99);
    const next = Math.max(0, Math.min(max, quantity));
    const previous = Number(cart[product.id] || 0);
    setCart((current) => ({ ...current, [product.id]: next }));
    if (previous === 0 && next > 0) {
      toast(`${product.name} was added to your basket.`, { title: "Added to basket" });
      track("add_to_cart", { product_id: product.id, business_id: selected?.id || "", branch_id: selectedBranchId || "", currency });
    }
    if (previous > 0 && next === 0) track("remove_from_cart", { product_id: product.id, business_id: selected?.id || "", branch_id: selectedBranchId || "", currency });
  }

  async function toggleFavorite(id) {
    if (!user || user.isAnonymous) return window.location.assign(`/login?next=${encodeURIComponent(`${basePath || "/"}?view=saved`)}`);
    const next = !favorites.includes(id);
    setFavorites((current) => next ? [...current, id] : current.filter((item) => item !== id));
    try { await saveFavorite(user.uid, id, next); } catch (error) { toast(error.message, { type: "error" }); }
  }

  async function payOrder(order) {
    try {
      const response = await authenticatedFetch("/api/payments/paynow/initiate", { method: "POST", body: JSON.stringify({ orderId: order.id, channel: "web" }) });
      if (response.redirectUrl) window.location.assign(response.redirectUrl);
    } catch (error) {
      toast(error.message, { type: "error" });
    }
  }

  function openBusiness(business) {
    track("select_business", { business_id: business.id || "", city: location.city || "", area: location.area || "", service: service || "home" });
    setSelected(business);
    setProductQuery("");
    setCategory("all");
    updateUrl("home", { business: business.id, order: null, service });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeBusiness() {
    setSelected(null);
    updateUrl("home", { business: null, order: null, service });
  }

  function requestBranchChange(id) {
    if (id === selectedBranchId) return;
    if (cartItems.length) setPendingBranchId(id); else setSelectedBranchId(id);
  }

  function confirmBranchChange() {
    setCart({});
    setSelectedBranchId(pendingBranchId);
    setPendingBranchId("");
  }

  if (!authReady || !settingsReady) return <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]"><LoaderCircle className="h-8 w-8 animate-spin text-violet" /></div>;
  if (maintenance) return <MarketplaceGate privateBeta={false} />;

  const serviceUnavailable = (service === "ride" && !ridesEnabled) || (service === "send" && !sendEnabled);
  const serviceLabel = service ? service[0].toUpperCase() + service.slice(1) : "Spotly";

  return <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={openHome} className="flex shrink-0 items-center gap-2.5 font-semibold">
          <Image src="/brand/spotly.svg" alt="" width={38} height={38} className="h-9 w-9" priority />
          <span className="hidden text-lg tracking-[-.025em] sm:block">Spotly</span>
        </button>

        <nav className="ml-3 hidden items-center gap-1 lg:flex" aria-label="Customer navigation">
          <button type="button" onClick={openHome} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", view === "home" && !selected ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>Home</button>
          <button type="button" onClick={() => updateUrl("activity", { business: null, order: null, service: null })} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", view === "activity" ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>Activity{orders.length ? ` ${orders.length}` : ""}</button>
          <button type="button" onClick={() => updateUrl("saved", { business: null, order: null, service: null })} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold", view === "saved" ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-2)] hover:bg-[var(--surface-hover)]")}>Saved</button>
        </nav>

        <div className="hidden min-w-0 flex-1 md:block">
          <button type="button" onClick={openSearch} className="mx-auto flex h-11 w-full max-w-[420px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 text-left text-sm text-[var(--text-3)] transition hover:bg-[var(--surface-hover)]"><Search className="h-4 w-4" /><span className="truncate">Search Spotly in {location.city}</span></button>
        </div>

        <button type="button" onClick={() => setLocationOpen((value) => !value)} className="ml-auto hidden max-w-[180px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold sm:flex"><MapPin className="h-4 w-4 text-[var(--accent)]" /><span className="truncate">{location.area || location.city}</span></button>
        <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold sm:text-sm">{(selectedBranch ? acceptedCurrencies : settings.commerce?.currencies || ["USD"]).map((item) => <option key={item} value={item}>{item === "ZWG" ? "ZiG" : item}</option>)}</select>
        {user && !user.isAnonymous ? <NotificationBell workspace="customer" /> : null}
        <Button asChild variant="outline" size="sm"><Link href={user && !user.isAnonymous ? "/account" : `/login?next=${encodeURIComponent(basePath || "/")}`}>{user && !user.isAnonymous ? profile?.displayName?.split(" ")[0] || "Account" : "Sign in"}</Link></Button>
      </div>
      {locationOpen ? <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)]"><div className="mx-auto max-w-[1180px] px-4 py-3 sm:px-6"><LocationControl value={location} cities={launchCities} supportedAreas={settings.launch?.supportedAreas} onChange={setLocation} onLocate={locate} locating={locating} /></div></div> : null}
    </header>

    <main className="mx-auto max-w-[1180px] px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-12">
      {loadError && businesses.length ? <div role="status" className="mb-4 flex flex-col gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] p-4 text-sm sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold text-[var(--on-warning-soft)]">Marketplace refresh is delayed</p><p className="mt-1 leading-6 text-secondary">{loadError}</p></div><Button variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="h-4 w-4" />Retry</Button></div> : null}

      {selected ? (
<section className="mt-7"><button type="button" onClick={closeBusiness} className="inline-flex items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft className="h-4 w-4" />Back to businesses</button><div className="mt-5 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center"><div className="relative h-20 w-20 overflow-hidden rounded-xl bg-[var(--surface-2)]"><BusinessVisual business={selected} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-[-.04em]">{selected.name}</h1>{["approved","verified"].includes(selected.verificationStatus)&&<Badge tone="success"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge>}</div><p className="mt-2 text-sm text-secondary">{selected.description||selected.category}</p></div><Link href={`/claim?business=${selected.id}`} className="text-sm font-semibold text-violet hover:underline">Manage or correct this listing</Link></div><div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]"><div>{businessDetailLoading?<Card variant="bordered" className="mb-6 p-6"><div className="flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin text-violet"/><div><p className="font-semibold">Loading this business</p><p className="mt-1 text-sm text-secondary">Checking published locations, availability and products.</p></div></div></Card>:branchError?<div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{branchError}</div>:branches.length?<div className="mb-6 rounded-xl border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--surface)] p-5"><div className="flex items-start gap-4"><MapPin className="mt-1 h-5 w-5 text-violet" /><div className="min-w-0 flex-1"><p className="font-semibold">Choose the exact {locationNoun}</p><p className="mt-1 text-sm leading-6 text-[var(--text-2)]">Products, prices, currency and pickup availability can differ by location.</p><div className="mt-4 flex flex-wrap gap-2">{branches.map((branch)=>{const active=branch.id===selectedBranchId;const availability=pickupAvailability(branch);return <button key={branch.id} type="button" onClick={()=>requestBranchChange(branch.id)} className={cn("rounded-lg border px-4 py-3 text-left",active?"border-violet bg-[var(--accent-soft)] ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]":"hover:border-violet/40")}><span className="block text-sm font-semibold">{branch.branchName||branch.name||`Main ${locationNoun}`}</span><span className="mt-1 block text-xs text-[var(--text-3)]">{branch.city||"Zimbabwe"}{branch.address?` · ${branch.address}`:""}</span><span className={cn("mt-2 block text-xs font-semibold",availability.available?"text-success":"text-warning")}>{availability.available?`Earliest ${availability.earliest.date} ${availability.earliest.slot.label}`:availability.reason}</span></button>;})}</div></div></div></div>:<LottieEmptyState name="location-pin" title="No customer location is published" description="This business cannot accept an online pickup order until it publishes a location." />}{businessDetailLoading?<div className="mt-5 flex items-center gap-3 rounded-xl border p-5 text-sm text-secondary"><LoaderCircle className="h-5 w-5 animate-spin text-violet"/>Loading published products…</div>:catalogError?<div role="alert" className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[var(--danger-soft)] p-4 text-sm text-[var(--on-danger-soft)]">{catalogError}</div>:<><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-violet">{selectedArchetype.shortLabel}</p><h2 className="mt-2 text-2xl font-semibold">{selectedArchetype.nouns.catalog}</h2></div><p className="text-sm text-[var(--text-3)]">{visibleProducts.length} shown</p></div>{branchProducts.length>0&&<div className="mt-5 space-y-3"><SearchField value={productQuery} onChange={setProductQuery} label={`Search ${selectedArchetype.nouns.catalog}`} placeholder={`Search ${selectedArchetype.nouns.items}`} /><div className="no-scrollbar flex gap-2 overflow-x-auto pb-1"><button onClick={()=>setCategory("all")} className={cn("rounded-full border px-3 py-2 text-sm font-semibold",category==="all"?"border-violet bg-violet-soft text-violet-strong":"bg-[var(--surface)]")}>All</button>{categories.map((item)=><button key={item} onClick={()=>setCategory(item)} className={cn("rounded-full border px-3 py-2 text-sm font-semibold",category===item?"border-violet bg-violet-soft text-violet-strong":"bg-[var(--surface)]")}>{item}</button>)}</div></div>}{visibleProducts.length?<div className="mt-5 grid gap-3 xl:grid-cols-2">{visibleProducts.map((product)=><ProductCard key={product.id} product={product} quantity={cart[product.id]||0} onChange={changeQuantity} currency={currency} archetype={selectedArchetype} />)}</div>:branchProducts.length?<LottieEmptyState className="mt-5" name="search-nearby" title="No matching products" description="Try another search or category." action={<Button variant="outline" onClick={()=>{setProductQuery("");setCategory("all");}}>Clear filters</Button>} />:<LottieEmptyState className="mt-5" name="storefront-open" title={`${selectedArchetype.nouns.catalog} not available yet`} description={`This business has not published available ${selectedArchetype.nouns.items} for this location.`} action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="outline"><Link href="/support?topic=listing-update">Suggest an update</Link></Button><Button onClick={closeBusiness}>Browse similar businesses</Button></div>} />}</>}</div>{selectedIsPickup?<aside className="hidden h-fit rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:sticky lg:top-24 lg:block"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onCheckout={()=>{track("begin_checkout",{business_id:selected?.id||"",branch_id:selectedBranchId||"",currency,item_count:cartItems.reduce((sum,item)=>sum+item.quantity,0)});setCheckout(true);}} /></aside>:<aside className="h-fit rounded-xl border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[var(--accent-soft)] p-5 lg:sticky lg:top-24"><ShieldCheck className="h-5 w-5 text-[var(--on-accent-soft)]" /><h2 className="mt-4 font-semibold">Online actions are not available yet</h2><p className="mt-2 text-sm leading-6 text-[color-mix(in_srgb,var(--on-accent-soft)_75%,transparent)]">You can review published information. This business has not enabled online {selectedArchetype.nouns.activity}.</p></aside>}</div></section>
      ) : view === "home" && !service ? (
        loading && !businesses.length ? <div className="flex min-h-[55vh] flex-col items-center justify-center text-center"><SpotlyLottie name="marketplace-discover" mode="loop" eager className="h-28 w-28" fallback={<Store className="h-9 w-9 text-violet" />} /><p className="mt-4 text-sm font-semibold">Opening Spotly in {location.city}…</p><p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-3)]">Loading verified businesses and current availability.</p></div> : loadError && !businesses.length ? <LottieEmptyState name="marketplace-discover" title="Spotly could not load nearby businesses" description={loadError} action={<Button onClick={() => setReloadKey((value) => value + 1)}><RefreshCw className="h-4 w-4" />Reload</Button>} /> : <MarketplaceHome businessResults={businessResults} orders={orders} location={location} ridesEnabled={ridesEnabled} sendEnabled={sendEnabled} onSelectService={enterService} onOpenBusiness={openBusiness} onSearch={openSearch} onActivity={() => updateUrl("activity", { business: null, order: null, service: null })} onLocation={() => setLocationOpen(true)} />
      ) : view === "activity" ? (
        <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Activity</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Everything you have in motion</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Orders and deliveries are live here now. Rides and bookings will join this same timeline as those services open.</p></div><Button variant="outline" onClick={openHome}>Back to Home</Button></div>
          {!user || user.isAnonymous ? <EmptyState className="mt-6" icon={PackageCheck} title="Sign in to see your activity" description="Orders and delivery progress are tied to your Spotly account." action={<Button asChild><Link href={`/login?next=${encodeURIComponent(`${basePath || "/"}?view=activity`)}`}>Sign in</Link></Button>} /> : orders.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{orders.map((order) => <OrderCard key={order.id} order={order} onPay={payOrder} highlighted={order.id === requestedOrder} innerRef={(node) => { orderRefs.current[order.id] = node; }} />)}</div> : <EmptyState className="mt-6" icon={PackageCheck} title="Nothing here yet" description="Your orders and other Spotly activity will appear here." action={<Button onClick={openHome}>Explore Spotly</Button>} />}
        </section>
      ) : view === "search" ? (
        <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Search{service ? ` · ${serviceLabel}` : ""}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Find something on Spotly</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Search verified businesses and categories available in {location.city}.</p></div>{service ? <button type="button" onClick={() => updateUrl("search", { business: null, order: null, service: null })} className="text-sm font-semibold text-[var(--accent)]">Search all Spotly</button> : null}</div>
          <div className="mt-5"><SearchField value={query} onChange={setQuery} label="Search Spotly" placeholder={service === "eat" ? "Restaurant, café or food" : service === "shop" ? "Store, category or business" : service === "book" ? "Spa, salon, service or activity" : service === "events" ? "Event, venue or category" : "Business or category"} /></div>
          <div className="mt-5 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setLocationOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold"><MapPin className="h-4 w-4" />{location.area || location.city}</button>{service ? <button type="button" onClick={() => updateUrl("search", { service: null })} className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold">{serviceLabel} ×</button> : null}</div>
          {loading ? <div className="flex items-center justify-center py-20"><LoaderCircle className="h-7 w-7 animate-spin text-violet" /></div> : shownBusinesses.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shownBusinesses.map(({ business, distance }) => <BusinessCard key={business.id} business={business} distance={distance} favorite={favorites.includes(business.id)} onFavorite={toggleFavorite} onOpen={openBusiness} />)}</div> : <LottieEmptyState className="mt-6" name="search-nearby" title={query ? `No results for “${query}”` : `No ${service ? `${serviceLabel.toLowerCase()} ` : ""}businesses found nearby`} description="Try a broader search, another area, or come back as more verified businesses go live." action={<Button variant="outline" onClick={() => { setQuery(""); setLocation((current) => ({ ...current, area: "", radiusKm: 50 })); }}>Broaden search</Button>} />}
        </section>
      ) : view === "saved" ? (
        <section className="rounded-[26px] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">Saved</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Places you want to come back to</h1></div><Button variant="outline" onClick={openHome}>Explore more</Button></div>
          {!user || user.isAnonymous ? <EmptyState className="mt-6" icon={Heart} title="Sign in to use Saved" description="Save businesses and keep them synced to your Spotly account." action={<Button asChild><Link href={`/login?next=${encodeURIComponent(`${basePath || "/"}?view=saved`)}`}>Sign in</Link></Button>} /> : shownBusinesses.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shownBusinesses.map(({ business, distance }) => <BusinessCard key={business.id} business={business} distance={distance} favorite onFavorite={toggleFavorite} onOpen={openBusiness} />)}</div> : <LottieEmptyState className="mt-6" name="verified-business" title="Nothing saved yet" description="Save a business to find it quickly later." action={<Button onClick={openHome}>Browse Spotly</Button>} />}
        </section>
      ) : (
        <div>
          <ServiceModeHeader service={service} location={location} ridesEnabled={ridesEnabled} sendEnabled={sendEnabled} onSelectService={enterService} onExit={openHome} onSearch={openSearch} />
          {serviceUnavailable ? <section className="mt-5 rounded-[24px] bg-[var(--surface)] p-6 sm:p-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-[var(--accent)]">Opening area by area</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{serviceLabel} is not accepting requests here yet.</h2><p className="mt-3 text-sm leading-7 text-[var(--text-2)]">We will only switch this on when the matching driver operations, safety support, and local availability are ready. You can keep using Spotly’s live marketplace in the meantime.</p><div className="mt-5 flex flex-wrap gap-3"><Button onClick={openHome}>Explore Spotly</Button><Button variant="outline" asChild><Link href="/support">Get support</Link></Button></div></div></section> : <section className="mt-5 rounded-[24px] bg-[var(--surface)] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[var(--accent)]">{serviceLabel} in {location.area || location.city}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{service === "eat" ? "Food around you" : service === "shop" ? "Shops and essentials" : service === "book" ? "Services and places" : service === "events" ? "Events and venues" : "Available nearby"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">Choose a verified business to see its exact locations, published offerings, prices, and availability.</p></div><p className="text-sm text-[var(--text-3)]">{shownBusinesses.length} available</p></div>{loading ? <div className="flex items-center justify-center py-16"><LoaderCircle className="h-7 w-7 animate-spin text-violet" /></div> : shownBusinesses.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shownBusinesses.map(({ business, distance }) => <BusinessCard key={business.id} business={business} distance={distance} favorite={favorites.includes(business.id)} onFavorite={toggleFavorite} onOpen={openBusiness} />)}</div> : <LottieEmptyState className="mt-6" name="search-nearby" title={`No ${serviceLabel.toLowerCase()} businesses are live here yet`} description={`Try another area or use Search to browse everything currently available in ${location.city}.`} action={<Button onClick={openSearch}>Search Spotly</Button>} />}</section>}
        </div>
      )}
    </main>

    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-8 text-sm text-[var(--text-3)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2"><Image src="/brand/spotly.svg" alt="" width={28} height={28} /><span>Spotly · Find it nearby. Get it done.</span></div>
        <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/claim">For businesses</Link><Link href="/drive">Drive & deliver</Link><Link href="/support">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
    </footer>

    <nav className="safe-bottom fixed inset-x-2 bottom-2 z-40 flex h-16 items-center rounded-[22px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-2 shadow-elevated backdrop-blur-xl lg:hidden" aria-label="Mobile customer navigation">
      <button type="button" onClick={openHome} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "home" && !selected ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><Store className="h-5 w-5" />Home</button>
      <button type="button" onClick={() => updateUrl("activity", { business: null, order: null, service: null })} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "activity" ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><PackageCheck className="h-5 w-5" />Activity</button>
      <button type="button" onClick={() => updateUrl("saved", { business: null, order: null, service: null })} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "saved" ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><Heart className="h-5 w-5" />Saved</button>
      <button type="button" onClick={openSearch} className={cn("flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold", view === "search" ? "text-[var(--accent)]" : "text-[var(--text-3)]")}><Search className="h-5 w-5" />Search</button>
    </nav>

    {selectedIsPickup && cartItems.length > 0 ? <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: .98 }} type="button" onClick={() => setBasketOpen(true)} className="safe-bottom fixed inset-x-3 bottom-20 z-30 flex items-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-3 text-left text-[var(--on-accent)] shadow-elevated lg:bottom-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface)]/15"><ShoppingBasket className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items</span><span className="block text-xs text-[color-mix(in_srgb,var(--on-accent)_70%,transparent)]">View basket</span></span><span className="font-semibold">{formatCurrency(cartTotal, currency)}</span></motion.button> : null}

    <Overlay open={basketOpen} onClose={() => setBasketOpen(false)} title="Your basket" description={`${cartItems.length} products`} mode="sheet"><BasketContents cartItems={cartItems} cartTotal={cartTotal} currency={currency} onClose={() => setBasketOpen(false)} onCheckout={() => { track("begin_checkout", { business_id: selected?.id || "", branch_id: selectedBranchId || "", currency, item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0) }); setBasketOpen(false); setCheckout(true); }} /></Overlay>
    <Modal open={Boolean(pendingBranchId)} onClose={() => setPendingBranchId("")} title="Switch business location?" description="Products, prices and availability can differ by location." size="sm"><div className="p-5"><p className="text-sm leading-6 text-secondary">Switching will clear the current basket so you can build an accurate order for the new location.</p><div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setPendingBranchId("")}>Keep this location</Button><Button className="flex-1" onClick={confirmBranchChange}>Switch and clear</Button></div></div></Modal>
    {selectedIsPickup ? <CheckoutModal open={checkout} onClose={() => setCheckout(false)} business={selected} branches={branches} selectedBranchId={selectedBranchId} cartItems={cartItems} currency={currency} user={user} onComplete={(order) => { setCart({}); removeState(CART_KEY, user); updateUrl("activity", { order: order.orderId || order.id, business: null, service: null }); }} /> : null}
  </div>;
}
